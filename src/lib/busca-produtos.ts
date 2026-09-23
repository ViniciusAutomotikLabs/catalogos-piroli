import { createClient } from "@/lib/supabase/server";
import { buscarTecDoc, tecdocSyntheticId } from "@/lib/tecdoc-catalog";
import { createErpClient } from "@/lib/supabase/erp";
import { getContextoLoja } from "@/lib/loja";

export type FonteProduto = "local" | "tecdoc" | "espelho";

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

/** Código ERP/catálogo sem espaços — evita RPC pesada (ex.: 000100 → 27s). */
function isCodeLike(termo: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/.test(termo);
}

function espelhoSyntheticId(codigo: string): number {
  let h = 0;
  for (let i = 0; i < codigo.length; i++) {
    h = (h * 31 + codigo.charCodeAt(i)) | 0;
  }
  // IDs negativos estáveis para linhas do espelho (não colidem com produtos.id)
  return -Math.abs(h || 1);
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
  const termo = opts.termo;
  const limite = opts.limite;

  // Termo tipo código (000100, PH2870A): caminho rápido — a RPC de ranking
  // estoura statement_timeout (~27s) por match em refs normalizadas.
  if (termo && isCodeLike(termo) && !opts.catalogo) {
    const [exatos, espelho] = await Promise.all([
      buscarCodigoExatoRapido({ termo, comFoto: opts.comFoto, limite }),
      buscarEspelhoPorTermo({ termo, limite }),
    ]);
    const vistos = new Set(exatos.produtos.map((p) => p.codigo_produto_interno));
    const extras = espelho.produtos.filter(
      (p) => !vistos.has(p.codigo_produto_interno)
    );
    const produtos = [...exatos.produtos, ...extras].slice(0, limite);
    return {
      produtos,
      total: Math.max(exatos.total + extras.length, produtos.length),
      viaRpc: false,
    };
  }

  const supabase = await createClient();

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

/** Match exato por código (eq) — evita ilike %código% e a RPC pesada. */
async function buscarCodigoExatoRapido(opts: {
  termo: string;
  comFoto: boolean;
  limite: number;
}): Promise<{ produtos: BuscaProdutoResultado[]; total: number }> {
  const supabase = await createClient();
  const t = opts.termo;

  const { data: porCodigo } = await supabase
    .from("produtos")
    .select(
      "id, codigo_produto_interno, codigo_principal, numero_produto, descricao, descricao_original, titulo_normalizado, aplicacao_resumo, foto_url, origem_catalogo, unidade, fabricantes(nome_fabricante)"
    )
    .or(
      `codigo_produto_interno.eq.${t},codigo_principal.eq.${t},numero_produto.eq.${t}`
    )
    .limit(opts.limite);

  const { data: refs } = await supabase
    .from("referencias_cruzadas")
    .select("produto_id")
    .eq("numero_referencia", t)
    .limit(40);

  const idsRef = [
    ...new Set(
      (refs ?? [])
        .map((r) => r.produto_id)
        .filter((id): id is number => id != null)
    ),
  ];

  let porRef: typeof porCodigo = [];
  if (idsRef.length > 0) {
    let q = supabase
      .from("produtos")
      .select(
        "id, codigo_produto_interno, codigo_principal, numero_produto, descricao, descricao_original, titulo_normalizado, aplicacao_resumo, foto_url, origem_catalogo, unidade, fabricantes(nome_fabricante)"
      )
      .in("id", idsRef)
      .limit(opts.limite);
    if (opts.comFoto) q = q.not("foto_url", "is", null);
    const { data } = await q;
    porRef = data ?? [];
  }

  const seen = new Set<number>();
  const merged = [...(porCodigo ?? []), ...porRef].filter((p) => {
    if (seen.has(p.id)) return false;
    if (opts.comFoto && !p.foto_url) return false;
    seen.add(p.id);
    return true;
  });

  const produtos = merged.map((p) => {
    const exactCode =
      p.codigo_principal === t ||
      p.codigo_produto_interno === t ||
      p.numero_produto === t;
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
      referencias: [],
      aplicacao_resumo: p.aplicacao_resumo,
      match_tipo: exactCode ? "codigo_exato" : "referencia_exata",
      match_valor: t,
      score: exactCode ? 1000 : 900,
    });
  });

  return { produtos, total: produtos.length };
}

/** Hits do espelho SS (estoque_saldos) para o termo de código. */
async function buscarEspelhoPorTermo(opts: {
  termo: string;
  limite: number;
}): Promise<{ produtos: BuscaProdutoResultado[] }> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { produtos: [] };

  const sb = await createErpClient();
  const t = opts.termo;
  const { data } = await sb
    .from("estoque_saldos")
    .select("codigo, descricao, preco, produto_id, quantidade, reservado")
    .eq("organizacao_id", contexto.organizacaoId)
    .or(`codigo.eq.${t},codigo.ilike."${t}%"`)
    .order("codigo")
    .limit(opts.limite);

  const produtos: BuscaProdutoResultado[] = (data ?? []).map((row) => {
    const codigo = String(row.codigo ?? "").trim();
    const qtd = Number(row.quantidade) || 0;
    const res = Number(row.reservado) || 0;
    return {
      id: row.produto_id ?? espelhoSyntheticId(codigo),
      codigo_principal: codigo,
      codigo_produto_interno: codigo,
      numero_produto: null,
      titulo_normalizado: row.descricao,
      descricao_original: row.descricao,
      descricao: row.descricao,
      origem_catalogo: "ssplus",
      foto_url: null,
      unidade: null,
      fabricante: null,
      referencias: [],
      aplicacao_resumo: `Estoque SS · disp. ${qtd - res}`,
      match_tipo: codigo === t ? "codigo_exato" : "codigo_normalizado",
      match_valor: t,
      score: codigo === t ? 1100 : 950,
      fonte: "espelho" as const,
    };
  });

  return { produtos };
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
