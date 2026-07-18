/**
 * Smoke: TecDoc (com filtros corretos), local BD, federado.
 * node --env-file=.env.local --env-file=.env scripts/smoke-busca-fontes.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { inferirFiltrosPostgREST } from "../src/lib/tecdoc-termos.ts";

const TECDOC = (process.env.TECDOC_API_URL ?? "http://31.97.93.135:3005").replace(
  /\/$/,
  ""
);

async function tecdocViaFiltros(termo) {
  const t0 = Date.now();
  const filtros = inferirFiltrosPostgREST(termo);
  console.log(`[TecDoc] q="${termo}" filtros=`, filtros);

  const resultados = await Promise.all(
    filtros.map(async (f) => {
      const params = new URLSearchParams({
        select: "article_id,description,model_name,vehicle_desc,image_url",
        [f.campo]: `ilike.*${f.valor.replace(/\*/g, "")}*`,
        limit: "40",
        offset: "0",
        order: "article_id.asc",
      });
      const res = await fetch(`${TECDOC}/view_busca_catalogo?${params}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    })
  );

  const ids = new Set(resultados.flat().map((r) => r.article_id));
  console.log(
    `[TecDoc] q="${termo}" unique_articles=${ids.size} raw=${resultados.flat().length} ${Date.now() - t0}ms`
  );
  const sample = resultados.flat()[0];
  if (sample) {
    console.log(
      "  sample:",
      sample.description,
      "/",
      sample.model_name
    );
  }
  return ids.size;
}

async function localOnly(termo, catalogo) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[Local] missing SUPABASE env");
    return 0;
  }
  const sb = createClient(url, key);
  const t0 = Date.now();

  if (catalogo && !termo) {
    const { data, error, count } = await sb
      .from("produtos")
      .select("id, codigo_principal, titulo_normalizado", { count: "exact" })
      .eq("origem_catalogo", catalogo)
      .order("id", { ascending: true })
      .range(0, 24);
    console.log(
      `[Local/catalogo] slug=${catalogo} error=${error?.message ?? "ok"} page=${data?.length ?? 0} total≈${count} ${Date.now() - t0}ms`
    );
    return data?.length ?? 0;
  }

  const { data, error } = await sb.rpc("buscar_produtos", {
    p_termo: termo || undefined,
    p_catalogo: catalogo || undefined,
    p_com_foto: false,
    p_pagina: 1,
    p_limite: 10,
  });
  const rows = data ?? [];
  console.log(
    `[Local/rpc] q="${termo}" error=${error?.message ?? "ok"} rows=${rows.length} total=${rows[0]?.total_count ?? 0} ${Date.now() - t0}ms`
  );
  return rows.length;
}

console.log("=== 1) TecDoc only (glossário/heurística) ===");
const nGol = await tecdocViaFiltros("gol");
const nFiltro = await tecdocViaFiltros("filtro");

console.log("\n=== 2) Local BD only ===");
const nCat = await localOnly("", "6043_pecista");
const nLoc = await localOnly("filtro");

console.log("\n=== 3) Federado (paralelo) ===");
const t0 = Date.now();
const [a, b] = await Promise.all([tecdocViaFiltros("gol"), localOnly("gol")]);
console.log(`[Federado] tecdoc=${a} local=${b} wall=${Date.now() - t0}ms`);

const ok = nGol > 0 && nFiltro > 0 && nCat > 0 && nLoc > 0 && a > 0 && b > 0;
console.log(ok ? "\nOK smoke" : "\nFALHA smoke");
process.exit(ok ? 0 : 1);
