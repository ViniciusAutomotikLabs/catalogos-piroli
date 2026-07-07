import { createClient } from "@/lib/supabase/server";

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
};

export type BuscaProdutosResponse = {
  produtos: BuscaProdutoResultado[];
  total: number;
  viaRpc: boolean;
};

const POR_PAGINA = 25;

function sanitize(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}

/**
 * Busca produtos via RPC `buscar_produtos` (ranking no Postgres).
 * Se a RPC ainda não existir no ambiente, faz fallback para query legada.
 */
export async function buscarProdutos(opts: {
  q: string;
  catalogo: string;
  comFoto: boolean;
  pagina: number;
  limite?: number;
}): Promise<BuscaProdutosResponse> {
  const supabase = await createClient();
  const termo = sanitize(opts.q);
  const limite = opts.limite ?? POR_PAGINA;

  const { data, error } = await supabase.rpc("buscar_produtos", {
    p_termo: termo || undefined,
    p_catalogo: opts.catalogo || undefined,
    p_com_foto: opts.comFoto,
    p_pagina: opts.pagina,
    p_limite: limite,
  });

  if (!error && data) {
    const rows = data as Array<BuscaProdutoResultado & { total_count: number }>;
    const total = rows[0]?.total_count ?? 0;
    return {
      produtos: rows.map((r) => ({
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
      })),
      total: Number(total),
      viaRpc: true,
    };
  }

  // Fallback: ambiente sem migration aplicada (função inexistente)
  if (error?.code !== "PGRST202" && error?.message && !error.message.includes("buscar_produtos")) {
    console.warn("[buscarProdutos] RPC falhou, usando fallback:", error.message);
  }

  return buscarProdutosLegado({ ...opts, termo, limite });
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
}): Promise<BuscaProdutosResponse> {
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

      return {
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
      };
    }),
    total: count ?? 0,
    viaRpc: false,
  };
}
