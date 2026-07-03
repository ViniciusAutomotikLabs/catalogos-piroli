#!/usr/bin/env npx tsx
/**
 * BE-03: backfill idempotente de normalização de produtos.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-normalizacao.ts
 *   ... --force    # reprocessa todos
 *   ... --limite=500
 */

import { createClient } from "@supabase/supabase-js";
import { normalizarProduto } from "../src/lib/produto-normalizador";

const BATCH = 200;

type Relatorio = {
  processados: number;
  atualizados: number;
  ok: number;
  parcial: number;
  revisar: number;
  codigos_corrigidos: number;
  erros: number;
};

function parseArgs() {
  const force = process.argv.includes("--force");
  let limite = 0;
  for (const arg of process.argv) {
    const m = arg.match(/^--limite=(\d+)$/);
    if (m) limite = parseInt(m[1], 10);
  }
  return { force, limite };
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { force, limite } = parseArgs();

  const relatorio: Relatorio = {
    processados: 0,
    atualizados: 0,
    ok: 0,
    parcial: 0,
    revisar: 0,
    codigos_corrigidos: 0,
    erros: 0,
  };

  console.log(`Backfill normalização — force=${force} limite=${limite || "∞"}`);

  let from = 0;
  while (true) {
    if (limite > 0 && relatorio.processados >= limite) break;

    const take = limite > 0 ? Math.min(BATCH, limite - relatorio.processados) : BATCH;
    const pageStart = force ? from : 0;

    let query = supabase
      .from("produtos")
      .select("id, descricao, codigo_produto_interno, numero_produto, normalizado_em")
      .order("id")
      .range(pageStart, pageStart + take - 1);

    if (!force) {
      query = query.is("normalizado_em", null);
    }

    const { data: batch, error } = await query;
    if (error) {
      console.error("Erro ao buscar lote:", error.message);
      process.exit(1);
    }
    if (!batch?.length) break;

    for (const row of batch) {
      try {
        const norm = normalizarProduto(row);
        const update: Record<string, unknown> = {
          descricao_original: norm.descricao_original,
          titulo_normalizado: norm.titulo_normalizado,
          codigo_principal: norm.codigo_principal,
          codigos_extraidos: norm.codigos_extraidos,
          medidas_extraidas: norm.medidas_extraidas,
          aplicacao_resumo: norm.aplicacao_resumo,
          normalizacao_status: norm.normalizacao_status,
          normalizado_em: new Date().toISOString(),
        };

        if (norm.corrigir_codigo_interno && norm.codigo_produto_interno_novo) {
          update.codigo_produto_interno_anterior = norm.codigo_produto_interno_anterior;
          update.codigo_produto_interno = norm.codigo_produto_interno_novo;
        }

        let codigoCorrigido = false;
        const { error: upErr } = await supabase.from("produtos").update(update).eq("id", row.id);
        if (upErr?.code === "23505" && norm.corrigir_codigo_interno) {
          const { codigo_produto_interno_anterior, codigo_produto_interno, ...semCorrecao } = update;
          const { error: retryErr } = await supabase.from("produtos").update(semCorrecao).eq("id", row.id);
          if (retryErr) throw retryErr;
        } else if (upErr) {
          throw upErr;
        } else if (norm.corrigir_codigo_interno) {
          codigoCorrigido = true;
        }

        relatorio.atualizados++;
        relatorio.processados++;
        if (norm.normalizacao_status === "ok") relatorio.ok++;
        else if (norm.normalizacao_status === "parcial") relatorio.parcial++;
        else relatorio.revisar++;
        if (codigoCorrigido) relatorio.codigos_corrigidos++;
      } catch (e) {
        relatorio.erros++;
        console.error(`Erro produto ${row.id}:`, e);
      }
    }

    if (force) from += batch.length;
    process.stdout.write(
      `\rProcessados: ${relatorio.processados} | ok=${relatorio.ok} parcial=${relatorio.parcial} revisar=${relatorio.revisar}`
    );

    if (batch.length < take) break;
  }

  console.log("\n\n=== Relatório ===");
  console.log(JSON.stringify(relatorio, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
