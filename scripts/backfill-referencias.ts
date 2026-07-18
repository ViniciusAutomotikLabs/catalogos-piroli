#!/usr/bin/env npx tsx
/**
 * Backfill de referências cruzadas a partir de `produtos.codigos_extraidos`.
 *
 * A tabela `referencias_cruzadas` está vazia; os códigos extraídos na
 * normalização (BE-01) contêm referências de catálogo que tornam a busca
 * por referência (`match_tipo = referencia_exata`) funcional.
 *
 * Filtros de confiança (conservador — melhor perder referência que criar
 * amarração errada):
 *   - `codigoConfiavel()` do normalizador (exige dígitos, rejeita palavras
 *     de peça, medidas de rosca etc.)
 *   - mínimo 3 caracteres
 *   - pelo menos 2 caracteres distintos (corta "0000", "111")
 *   - diferente (normalizado) dos códigos do próprio produto
 *
 * Idempotente: consulta referências existentes por produto antes de inserir.
 *
 * Uso:
 *   npx tsx scripts/backfill-referencias.ts --dry-run
 *   npx tsx scripts/backfill-referencias.ts
 *   npx tsx scripts/backfill-referencias.ts --limite=1000
 *
 * Rollback (só remove as criadas por este script — fabricante nulo e
 * numero presente em codigos_extraidos do produto):
 *   DELETE FROM referencias_cruzadas rc
 *   USING produtos p
 *   WHERE rc.produto_id = p.id
 *     AND rc.fabricante_referencia IS NULL
 *     AND rc.numero_referencia = ANY (p.codigos_extraidos);
 */

import { createClient } from "@supabase/supabase-js";
import { codigoConfiavel } from "../src/lib/produto-normalizador";

const BATCH = 500;

function normalizar(c: string): string {
  return c.toLowerCase().replace(/[\s./\-]/g, "");
}

function referenciaConfiavel(c: string): boolean {
  const limpo = c.trim();
  if (limpo.length < 3) return false;
  if (new Set(limpo.split("")).size < 2) return false;
  return codigoConfiavel(limpo);
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  let limite = 0;
  for (const arg of process.argv) {
    const m = arg.match(/^--limite=(\d+)$/);
    if (m) limite = parseInt(m[1], 10);
  }
  return { dryRun, limite };
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { dryRun, limite } = parseArgs();

  const rel = {
    produtos_lidos: 0,
    produtos_com_candidatos: 0,
    candidatos: 0,
    filtrados_ruido: 0,
    ja_existentes: 0,
    inseridos: 0,
    erros: 0,
  };

  console.log(`Backfill referências cruzadas — dryRun=${dryRun} limite=${limite || "∞"}`);

  let ultimoId = 0;
  while (true) {
    const { data: produtos, error } = await supabase
      .from("produtos")
      .select("id, codigo_principal, codigo_produto_interno, numero_produto, codigos_extraidos")
      .not("codigos_extraidos", "is", null)
      .neq("codigos_extraidos", "{}")
      .gt("id", ultimoId)
      .order("id", { ascending: true })
      .limit(BATCH);

    if (error) {
      console.error("Erro ao listar produtos:", error.message);
      process.exit(1);
    }
    if (!produtos || produtos.length === 0) break;

    ultimoId = produtos[produtos.length - 1].id;
    rel.produtos_lidos += produtos.length;

    // Referências já existentes para o lote (idempotência).
    // Paginado: o PostgREST trunca em 1000 linhas por resposta.
    const ids = produtos.map((p) => p.id);
    const refsExistentes: { produto_id: number; numero_referencia: string }[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: pagina, error: refErr } = await supabase
        .from("referencias_cruzadas")
        .select("produto_id, numero_referencia")
        .in("produto_id", ids)
        .order("id", { ascending: true })
        .range(offset, offset + 999);
      if (refErr) {
        console.error("Erro ao ler referências existentes:", refErr.message);
        process.exit(1);
      }
      refsExistentes.push(...(pagina ?? []));
      if (!pagina || pagina.length < 1000) break;
    }

    const existentes = new Map<number, Set<string>>();
    for (const r of refsExistentes ?? []) {
      if (!existentes.has(r.produto_id)) existentes.set(r.produto_id, new Set());
      existentes.get(r.produto_id)!.add(normalizar(r.numero_referencia));
    }

    const inserts: { produto_id: number; numero_referencia: string }[] = [];

    for (const p of produtos) {
      const proprios = new Set(
        [p.codigo_principal, p.codigo_produto_interno, p.numero_produto]
          .filter((c): c is string => Boolean(c))
          .map(normalizar)
      );
      const refsProd = existentes.get(p.id) ?? new Set<string>();
      const vistos = new Set<string>();
      let algum = false;

      for (const bruto of (p.codigos_extraidos ?? []) as string[]) {
        const c = bruto.trim();
        const norm = normalizar(c);
        if (!norm || proprios.has(norm) || vistos.has(norm)) continue;
        vistos.add(norm);
        rel.candidatos++;

        if (!referenciaConfiavel(c)) {
          rel.filtrados_ruido++;
          continue;
        }
        if (refsProd.has(norm)) {
          rel.ja_existentes++;
          continue;
        }
        inserts.push({ produto_id: p.id, numero_referencia: c });
        algum = true;
      }
      if (algum) rel.produtos_com_candidatos++;
    }

    if (!dryRun && inserts.length > 0) {
      const { error: insErr } = await supabase.from("referencias_cruzadas").insert(inserts);
      if (insErr) {
        console.error(`Erro ao inserir lote (ultimoId=${ultimoId}):`, insErr.message);
        rel.erros += inserts.length;
      } else {
        rel.inseridos += inserts.length;
      }
    } else {
      rel.inseridos += inserts.length; // contagem do dry-run
    }

    if (rel.produtos_lidos % 5000 < BATCH) {
      console.log(
        `... ${rel.produtos_lidos} produtos | ${rel.inseridos} referências ${dryRun ? "(dry-run)" : "inseridas"}`
      );
    }
    if (limite && rel.produtos_lidos >= limite) break;
  }

  console.log("\nRelatório final:");
  console.log(JSON.stringify(rel, null, 2));
  if (dryRun) console.log("\nDry-run — nada foi gravado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
