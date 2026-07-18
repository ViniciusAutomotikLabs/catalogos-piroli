import { createClient } from "@/lib/supabase/server";
import { buscarTecDoc, tecdocSyntheticId } from "@/lib/tecdoc-catalog";

export type FonteProduto = "local" | "tecdoc";

export type BuscaProdutoResultado = {
  id: number;
  codigo_principal: string | null;
  codigo_produto_interno: string;
  numero_produto: string | null;
  titulo_normalizado: string | null;
  descricao_original: string | null;
  descricao: string | null;
  origem_catalogo: string;
  foto_url: string | null;
  unidade: string | null;
  fabricante: string | null;
  referencias: string[];
  aplicacao_resumo: string | null;
  match_tipo: string | null;
  match_valor: string | null;
  score: number;
  fonte: FonteProduto;
  externalId?: string;
  articleId?: number;
  vehicleContext?: string;
};

export type BuscaProdutosResponse = {
  produtos: BuscaProdutoResultado[];
  total: number;
  totalLocal: number;
  totalTecdoc: number;
  viaRpc: boolean;
};

const POR_PAGINA = 25;
const TECDOC_LIMITE = 10;

function sanitize(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}

function mapLocalRow(
  r: Omit<BuscaProdutoResultado, "fonte"> & { fonte?: FonteProduto }
): BuscaProdutoResultado {
  return {
    id: r.id,
    codigo_principal: r.codigo_principal,
    codigo_produto_interno: r.codigo_produto_interno,
    numero_produto: r.numero_produto,
    titulo_normalizado: r.titulo_normalizado,
    descricao_original: r.descricao_original,
    descricao: r.descricao,
    origem_catalogo: r.origem_catalogo,
    foto_url: r.foto_url,
    unidade: r.unidade,
    fabricante: r.fabricante,
    referencias: r.referencias ?? [],
    aplicacao_resumo: r.aplicacao_resumo ?? null,
    match_tipo: r.match_tipo,
    match_valor: r.match_valor,
    score: Number(r.score) || 0,
    fonte: "local",
  };
}

/**
 * Busca produtos via RPC `buscar_produtos` + complemento TecDoc (federado).
 * TecDoc só entra quando há termo ≥ 2 chars, nenhum filtro de catálogo local
 * e fonte !== "local".
 *
 * `fonte`:
 * - `todos` (padrão) — local + TecDoc
 * - `local` — só Supabase
 * - `tecdoc` — só TecDoc (exige termo ≥ 2)
 */
export async function buscarProdutos(opts: {
  q: string;
  catalogo: string;
  comFoto: boolean;
  pagina: number;
  limite?: number;
  fonte?: "todos" | "local" | "tecdoc";
}): Promise<BuscaProdutosResponse> {
  const termo = sanitize(opts.q);
  const limite = opts.limite ?? POR_PAGINA;
  const fonte = opts.fonte ?? "todos";

  const incluirLocal = fonte !== "tecdoc";
  const incluirTecDoc =
    fonte !== "local" && termo.length >= 2 && !opts.catalogo;

  // Navegação "Ver produtos" do catálogo (sem termo): caminho leve, sem RPC de ranking
  if (incluirLocal && !termo && opts.catalogo) {
    const local = await listarPorCatalogo({
      catalogo: opts.catalogo,
      comFoto: opts.comFoto,
      pagina: opts.pagina,
      limite,
    });
    return {
      produtos: local.produtos,
      total: local.total,
      totalLocal: local.total,
      totalTecdoc: 0,
      viaRpc: false,
    };
  }

  const [local, tecdoc] = await Promise.all([
    incluirLocal
      ? buscarProdutosLocal({ ...opts, termo, limite })
      : Promise.resolve({ produtos: [] as BuscaProdutoResultado[], total: 0, viaRpc: false }),
    incluirTecDoc
      ? buscarTecDoc({
          termo,
          comFoto: opts.comFoto,
          limite: TECDOC_LIMITE,
          offset: 0,
        })
      : Promise.resolve({ itens: [], total: 0 }),
  ]);

  const tecdocProdutos: BuscaProdutoResultado[] = tecdoc.itens.map((item) => ({
    id: tecdocSyntheticId(item.articleId),
    codigo_principal: item.codigo,
    codigo_produto_interno: item.codigo,
    numero_produto: null,
    titulo_normalizado: item.description,
    descricao_original: item.description,
    descricao: item.description,
    origem_catalogo: "tecdoc",
    foto_url: item.imageUrl,
    unidade: null,
    fabricante: "TecDoc",
    referencias: [],
    aplicacao_resumo: item.vehicleContext,
    match_tipo: "texto",
    match_valor: null,
    score: 50,
    fonte: "tecdoc" as const,
    externalId: `tecdoc:${item.articleId}`,
    articleId: item.articleId,
    vehicleContext: item.vehicleContext ?? undefined,
  }));

  const produtos =
    fonte === "tecdoc"
      ? tecdocProdutos
      : [...local.produtos, ...tecdocProdutos];

  return {
    produtos,
    total: (fonte === "tecdoc" ? 0 : local.total) + tecdoc.total,
    totalLocal: fonte === "tecdoc" ? 0 : local.total,
    totalTecdoc: tecdoc.total,
    viaRpc: local.viaRpc,
  };
}

/** Listagem rápida por catálogo (sem termo) — evita timeout da RPC de ranking. */
async function listarPorCatalogo(opts: {
  catalogo: string;
  comFoto: boolean;
  pagina: number;
  limite: number;
}): Promise<{ produtos: BuscaProdutoResultado[]; total: number }> {
  const supabase = await createClient();

  const [{ data: cat }, page] = await Promise.all([
    supabase
      .from("catalogos")
      .select("produtos_count")
      .eq("slug", opts.catalogo)
      .maybeSingle(),
    (async () => {
      let query = supabase
        .from("produtos")
        .select(
          "id, codigo_produto_interno, codigo_principal, numero_produto, descricao, descricao_original, titulo_normalizado, aplicacao_resumo, foto_url, origem_catalogo, unidade, fabricantes(nome_fabricante)"
        )
        .eq("origem_catalogo", opts.catalogo)
        .order("id", { ascending: true });

      if (opts.comFoto) query = query.not("foto_url", "is", null);

      const de = (opts.pagina - 1) * opts.limite;
      return query.range(de, de + opts.limite - 1);
    })(),
  ]);

  const { data: produtos, error } = page;
  if (error) {
    console.warn("[listarPorCatalogo]", error.message);
    return { produtos: [], total: 0 };
  }

  const ids = (produtos ?? []).map((p) => p.id);
  const refsPorProduto = new Map<number, string[]>();
  if (ids.length > 0) {
    const { data: refs } = await supabase
      .from("referencias_cruzadas")
      .select("produto_id, numero_referencia")
      .in("produto_id", ids)
      .limit(200);
    for (const r of refs ?? []) {
      if (r.produto_id == null || !r.numero_referencia) continue;
      const lista = refsPorProduto.get(r.produto_id) ?? [];
      if (lista.length < 5) lista.push(r.numero_referencia);
      refsPorProduto.set(r.produto_id, lista);
    }
  }

  let total = cat?.produtos_count ?? 0;
  if (opts.comFoto) {
    const { count: cFoto } = await supabase
      .from("produtos")
      .select("id", { count: "exact", head: true })
      .eq("origem_catalogo", opts.catalogo)
      .not("foto_url", "is", null);
    total = cFoto ?? 0;
  } else if (!total) {
    const { count: cAll } = await supabase
      .from("produtos")
      .select("id", { count: "exact", head: true })
      .eq("origem_catalogo", opts.catalogo);
    total = cAll ?? 0;
  }

  return {
    total,
    produtos: (produtos ?? []).map((p) =>
      mapLocalRow({
        id: p.id,
        codigo_principal: p.codigo_principal,
        codigo_produto_interno: p.codigo_produto_interno,
        numero_produto: p.numero_produto,
        titulo_normalizado: p.titulo_normalizado,
        descricao_original: p.descricao_original,
        descricao: p.descricao,
        origem_catalogo: p.origem_catalogo,
        foto_url: p.foto_url,
        unidade: p.unidade,
        fabricante: p.fabricantes?.nome_fabricante ?? null,
        referencias: refsPorProduto.get(p.id) ?? [],
        aplicacao_resumo: p.aplicacao_resumo,
        match_tipo: "texto",
        match_valor: null,
        score: 0,
      })
    ),
  };
}

async function buscarProdutosLocal(opts: {
  q?: string;
  termo: string;
  catalogo: string;
  comFoto: boolean;
  pagina: number;
  limite: number;
}): Promise<{ produtos: BuscaProdutoResultado[]; total: number; viaRpc: boolean }> {
  const supabase = await createClient();
  const termo = opts.termo;
  const limite = opts.limite;

  const { data, error } = await supabase.rpc("buscar_produtos", {
    p_termo: termo || undefined,
    p_catalogo: opts.catalogo || undefined,
    p_com_foto: opts.comFoto,
    p_pagina: opts.pagina,
    p_limite: limite,
  });

  if (!error && data) {
    const rows = data as Array<
      Omit<BuscaProdutoResultado, "fonte"> & { total_count: number }
    >;
    const total = rows[0]?.total_count ?? 0;
    return {
      produtos: rows.map((r) => mapLocalRow(r)),
      total: Number(total),
      viaRpc: true,
    };
  }

  if (error?.code !== "PGRST202" && error?.message && !error.message.includes("buscar_produtos")) {
    console.warn("[buscarProdutos] RPC falhou, usando fallback:", error.message);
  }

  return buscarProdutosLegado({
    termo,
    catalogo: opts.catalogo,
    comFoto: opts.comFoto,
    pagina: opts.pagina,
    limite,
  });
}

function apenasCodigo(q: string) {
  return q.replace(/[\s./-]/g, "");
}

async function buscarProdutosLegado(opts: {
  termo: string;
  catalogo: string;
  comFoto: boolean;
  pagina: number;
  limite: number;
}): Promise<{ produtos: BuscaProdutoResultado[]; total: number; viaRpc: boolean }> {
  const supabase = await createClient();
  const q = opts.termo;
  const qCodigo = apenasCodigo(q);

  let idsPorReferencia: number[] = [];
  if (q) {
    const refPartes = [`numero_referencia.ilike.%${q}%`];
    if (qCodigo && qCodigo !== q) refPartes.push(`numero_referencia.ilike.%${qCodigo}%`);
    const { data: refs } = await supabase
      .from("referencias_cruzadas")
      .select("produto_id")
      .or(refPartes.join(","))
      .limit(100);
    idsPorReferencia = (refs ?? [])
      .map((r) => r.produto_id)
      .filter((id): id is number => id !== null);
  }

  let query = supabase
    .from("produtos")
    .select(
      "id, codigo_produto_interno, codigo_principal, numero_produto, descricao, descricao_original, titulo_normalizado, aplicacao_resumo, foto_url, origem_catalogo, unidade, fabricantes(nome_fabricante), referencias_cruzadas(numero_referencia)",
      { count: "exact" }
    );

  if (q) {
    const pattern = `%${q}%`;
    const orParts = [
      `codigo_produto_interno.ilike.${pattern}`,
      `codigo_principal.ilike.${pattern}`,
      `numero_produto.ilike.${pattern}`,
      `titulo_normalizado.ilike.${pattern}`,
      `descricao.ilike.${pattern}`,
      `descricao_original.ilike.${pattern}`,
    ];
    if (qCodigo && qCodigo !== q) {
      const patternCodigo = `%${qCodigo}%`;
      orParts.push(`codigo_produto_interno.ilike.${patternCodigo}`);
      orParts.push(`codigo_principal.ilike.${patternCodigo}`);
      orParts.push(`numero_produto.ilike.${patternCodigo}`);
    }
    if (idsPorReferencia.length > 0) {
      orParts.push(`id.in.(${idsPorReferencia.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }
  if (opts.catalogo) query = query.eq("origem_catalogo", opts.catalogo);
  if (opts.comFoto) query = query.not("foto_url", "is", null);

  query = query.order("id", { ascending: true });

  const de = (opts.pagina - 1) * opts.limite;
  const { data: produtos, count } = await query.range(de, de + opts.limite - 1);

  const refSet = new Set(idsPorReferencia);

  return {
    produtos: (produtos ?? []).map((p) => {
      const refs = (p.referencias_cruzadas ?? [])
        .map((r) => r.numero_referencia)
        .filter((r): r is string => Boolean(r));
      const viaRef =
        q &&
        refSet.has(p.id) &&
        ![p.codigo_principal, p.codigo_produto_interno, p.numero_produto, p.descricao].some(
          (campo) => campo && campo.toLowerCase().includes(q.toLowerCase())
        );

      return mapLocalRow({
        id: p.id,
        codigo_principal: p.codigo_principal,
        codigo_produto_interno: p.codigo_produto_interno,
        numero_produto: p.numero_produto,
        titulo_normalizado: p.titulo_normalizado,
        descricao_original: p.descricao_original,
        descricao: p.descricao,
        origem_catalogo: p.origem_catalogo,
        foto_url: p.foto_url,
        unidade: p.unidade,
        fabricante: p.fabricantes?.nome_fabricante ?? null,
        referencias: refs,
        aplicacao_resumo: p.aplicacao_resumo,
        match_tipo: viaRef ? "referencia_exata" : "texto",
        match_valor: null,
        score: 0,
      });
    }),
    total: count ?? 0,
    viaRpc: false,
  };
}
