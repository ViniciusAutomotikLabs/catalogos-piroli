#!/usr/bin/env npx tsx
/**
 * ERP 2.0 — Backfill de compatibilidade: `clientes` (v1) → `pessoas` (v2).
 *
 * Cada cliente vira uma Pessoa (papel "cliente") na organização da sua loja,
 * preservando o orçamento: liga `orcamentos.pessoa_id` mantendo `cliente_id`.
 * O CNPJ é CIFRADO na aplicação (a chave nunca vai ao banco) e ganha blind index
 * + máscara. Idempotente: reexecuta sem duplicar (usa blind index p/ detectar).
 *
 * Pré-requisitos: migrations 007–010 aplicadas; lojas com organizacao_id definido.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   ERP_ENCRYPTION_KEY=... ERP_BLIND_INDEX_KEY=... \
 *   npx tsx scripts/backfill-clientes-pessoas.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import {
  blindIndexContato,
  blindIndexDocumento,
  cifrar,
  criptografiaConfigurada,
  mascararDocumento,
} from "../src/lib/crypto";

type ClienteRow = {
  id: number;
  loja_id: number;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  contato_nome: string | null;
  telefone_whatsapp: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean | null;
};

const BATCH = 200;

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!criptografiaConfigurada()) {
    console.error("Defina ERP_ENCRYPTION_KEY e ERP_BLIND_INDEX_KEY (mesmas do app).");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Mapa loja_id -> organizacao_id
  const { data: lojas, error: errLojas } = await supabase
    .from("lojas")
    .select("id, organizacao_id");
  if (errLojas) {
    console.error("Erro lendo lojas:", errLojas.message);
    process.exit(1);
  }
  const orgDaLoja = new Map<number, number | null>();
  for (const l of (lojas ?? []) as { id: number; organizacao_id: number | null }[]) {
    orgDaLoja.set(l.id, l.organizacao_id);
  }

  const rel = { processados: 0, criados: 0, reaproveitados: 0, orcamentosLigados: 0, pulados: 0, erros: 0 };
  console.log(`Backfill clientes→pessoas — dry-run=${dryRun}`);

  let from = 0;
  for (;;) {
    const { data: clientes, error } = await supabase
      .from("clientes")
      .select(
        "id, loja_id, razao_social, nome_fantasia, cnpj, contato_nome, telefone_whatsapp, email, cep, logradouro, numero, complemento, bairro, cidade, uf, ativo"
      )
      .order("id", { ascending: true })
      .range(from, from + BATCH - 1);
    if (error) {
      console.error("Erro lendo clientes:", error.message);
      process.exit(1);
    }
    const lote = (clientes ?? []) as ClienteRow[];
    if (lote.length === 0) break;

    for (const c of lote) {
      rel.processados++;
      const organizacaoId = orgDaLoja.get(c.loja_id) ?? null;
      if (!organizacaoId) {
        rel.pulados++;
        console.warn(`  cliente ${c.id}: loja ${c.loja_id} sem organizacao_id — pulado.`);
        continue;
      }

      try {
        // Detecta pessoa já criada (por blind index de documento, se houver).
        let pessoaId: number | null = null;
        const bidx = blindIndexDocumento(c.cnpj);
        if (bidx) {
          const { data: existente } = await supabase
            .from("pessoas")
            .select("id")
            .eq("organizacao_id", organizacaoId)
            .eq("documento_bidx", bidx)
            .maybeSingle();
          pessoaId = (existente as { id: number } | null)?.id ?? null;
        }

        if (pessoaId) {
          rel.reaproveitados++;
        } else if (!dryRun) {
          const { data: nova, error: errIns } = await supabase
            .from("pessoas")
            .insert({
              organizacao_id: organizacaoId,
              tipo_pessoa: "PJ",
              nome: c.razao_social,
              nome_fantasia: c.nome_fantasia,
              documento_cifrado: cifrar(c.cnpj),
              documento_bidx: bidx,
              documento_mascara: mascararDocumento(c.cnpj),
              situacao: c.ativo === false ? "inativo" : "ativo",
            })
            .select("id")
            .single();
          if (errIns) throw new Error(errIns.message);
          pessoaId = (nova as { id: number }).id;
          rel.criados++;

          await supabase.from("pessoa_papeis").insert({ pessoa_id: pessoaId, papel: "cliente" });

          if (c.telefone_whatsapp) {
            await supabase.from("pessoa_contatos").insert({
              pessoa_id: pessoaId,
              canal: "whatsapp",
              valor_cifrado: cifrar(c.telefone_whatsapp),
              valor_bidx: blindIndexContato(c.telefone_whatsapp, "whatsapp"),
              rotulo: c.contato_nome,
            });
          }
          if (c.email) {
            await supabase.from("pessoa_contatos").insert({
              pessoa_id: pessoaId,
              canal: "email",
              valor_cifrado: cifrar(c.email),
              valor_bidx: blindIndexContato(c.email, "email"),
            });
          }
          if (c.logradouro || c.cep || c.cidade) {
            await supabase.from("pessoa_enderecos").insert({
              pessoa_id: pessoaId,
              cep: c.cep,
              logradouro: c.logradouro,
              numero: c.numero,
              complemento: c.complemento,
              bairro: c.bairro,
              cidade: c.cidade,
              uf: c.uf,
              principal: true,
            });
          }
        } else {
          rel.criados++; // dry-run: contabiliza o que criaria
        }

        // Liga os orçamentos deste cliente à pessoa (mantém cliente_id).
        if (pessoaId && !dryRun) {
          const { data: ligados } = await supabase
            .from("orcamentos")
            .update({ pessoa_id: pessoaId })
            .eq("cliente_id", c.id)
            .is("pessoa_id", null)
            .select("id");
          rel.orcamentosLigados += (ligados ?? []).length;
        }
      } catch (e) {
        rel.erros++;
        console.error(`  cliente ${c.id}: erro`, e instanceof Error ? e.message : e);
      }
    }

    from += BATCH;
  }

  console.log("\nResumo:", rel);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
