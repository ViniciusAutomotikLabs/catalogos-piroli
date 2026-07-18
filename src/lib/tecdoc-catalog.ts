/**
 * Cliente server-side da API PostgREST TecDoc (VPS).
 * Nunca chamar sem limit — a view tem 60M+ linhas.
 */

import { inferirFiltrosPostgREST, type TecDocFiltro } from "./tecdoc-termos";

const TIMEOUT_MS = 5000;
const LIMIT_PADRAO = 10;
const SELECT =
  "article_id,description,model_name,vehicle_desc,image_url";

export type TecDocRow = {
  article_id: number;
  description: string | null;
  model_name: string | null;
  vehicle_desc: string | null;
  image_url: string | null;
};

export type TecDocItemMapeado = {
  articleId: number;
  codigo: string;
  description: string | null;
  imageUrl: string | null;
  vehicleContext: string | null;
  aplicacoes: string[];
};

export type TecDocBuscaOpts = {
  termo: string;
  comFoto?: boolean;
  limite?: number;
  offset?: number;
};

function baseUrl(): string | null {
  const url = process.env.TECDOC_API_URL?.trim();
  if (!url) return null;
  return url.replace(/\/$/, "");
}

function ilikeValue(valor: string): string {
  return `*${valor.replace(/\*/g, "").replace(/,/g, " ").trim()}*`;
}

function buildUrl(
  filtro: TecDocFiltro,
  opts: { comFoto: boolean; limite: number; offset: number }
): string {
  const base = baseUrl();
  if (!base) throw new Error("TECDOC_API_URL não configurada");

  const params = new URLSearchParams();
  params.set("select", SELECT);
  params.set(filtro.campo, `ilike.${ilikeValue(filtro.valor)}`);
  if (opts.comFoto) params.set("image_url", "not.is.null");
  params.set("limit", String(opts.limite));
  params.set("offset", String(opts.offset));
  params.set("order", "article_id.asc");

  return `${base}/view_busca_catalogo?${params.toString()}`;
}

async function fetchFiltro(
  filtro: TecDocFiltro,
  opts: { comFoto: boolean; limite: number; offset: number }
): Promise<TecDocRow[]> {
  const url = buildUrl(filtro, opts);
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TecDoc HTTP ${res.status}`);
  }
  const data = (await res.json()) as TecDocRow[];
  return Array.isArray(data) ? data : [];
}

/** Dedup por article_id: mantém a primeira linha e agrega aplicações distintas. */
export function dedupPorArticleId(
  rows: TecDocRow[]
): Array<TecDocRow & { aplicacoes: string[] }> {
  const mapa = new Map<number, TecDocRow & { aplicacoes: string[] }>();
  for (const row of rows) {
    const app = [row.model_name, row.vehicle_desc].filter(Boolean).join(" ").trim();
    const existing = mapa.get(row.article_id);
    if (!existing) {
      mapa.set(row.article_id, {
        ...row,
        aplicacoes: app ? [app] : [],
      });
    } else if (app && !existing.aplicacoes.includes(app)) {
      existing.aplicacoes.push(app);
      if (!existing.image_url && row.image_url) existing.image_url = row.image_url;
    }
  }
  return [...mapa.values()];
}

/** ID sintético negativo para não colidir com produtos.id do Supabase. */
export function tecdocSyntheticId(articleId: number): number {
  return -Math.abs(articleId);
}

export function mapTecDocItem(
  row: TecDocRow & { aplicacoes?: string[] }
): TecDocItemMapeado {
  const aplicacoes = row.aplicacoes ?? [];
  const vehicleContext =
    aplicacoes.slice(0, 3).join(" · ") ||
    [row.model_name, row.vehicle_desc].filter(Boolean).join(" ") ||
    null;

  return {
    articleId: row.article_id,
    codigo: `TecDoc-${row.article_id}`,
    description: row.description,
    imageUrl: row.image_url,
    vehicleContext,
    aplicacoes,
  };
}

/**
 * Busca no catálogo TecDoc. Retorna [] se URL não configurada, termo curto ou erro.
 */
export async function buscarTecDoc(
  opts: TecDocBuscaOpts
): Promise<{ itens: TecDocItemMapeado[]; total: number }> {
  const termo = opts.termo?.trim() ?? "";
  if (termo.length < 2) return { itens: [], total: 0 };
  if (!baseUrl()) return { itens: [], total: 0 };

  const filtros = inferirFiltrosPostgREST(termo);
  if (filtros.length === 0) return { itens: [], total: 0 };

  const limite = Math.min(opts.limite ?? LIMIT_PADRAO, 15);
  const offset = Math.max(0, opts.offset ?? 0);
  const comFoto = opts.comFoto ?? false;
  // A view duplica linhas por veículo — buscar mais linhas brutas para sobrar após dedup
  const limiteFetch = Math.min(Math.max(limite * 8, 40), 80);

  try {
    const resultados = await Promise.all(
      filtros.map((f) =>
        fetchFiltro(f, { comFoto, limite: limiteFetch, offset }).catch((err) => {
          console.warn(
            "[TecDoc] filtro falhou:",
            f.campo,
            err instanceof Error ? err.message : err
          );
          return [] as TecDocRow[];
        })
      )
    );

    const unidos = resultados.flat();
    const dedupados = dedupPorArticleId(unidos).slice(0, limite);
    return {
      itens: dedupados.map(mapTecDocItem),
      total: dedupados.length,
    };
  } catch (err) {
    console.warn("[TecDoc] busca falhou:", err instanceof Error ? err.message : err);
    return { itens: [], total: 0 };
  }
}

/**
 * Detalhe de um article_id: retorna descrição, foto e aplicações deduplicadas.
 */
export async function buscarTecDocDetalhe(articleId: number): Promise<{
  articleId: number;
  description: string | null;
  imageUrl: string | null;
  aplicacoes: string[];
  codigo: string;
} | null> {
  if (!baseUrl() || !Number.isFinite(articleId) || articleId <= 0) return null;

  const base = baseUrl()!;
  const params = new URLSearchParams({
    select: SELECT,
    article_id: `eq.${articleId}`,
    limit: "30",
    offset: "0",
    order: "article_id.asc",
  });

  try {
    const res = await fetch(`${base}/view_busca_catalogo?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as TecDocRow[];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const first = dedupPorArticleId(rows)[0];
    return {
      articleId: first.article_id,
      description: first.description,
      imageUrl: first.image_url,
      aplicacoes: first.aplicacoes,
      codigo: `TecDoc-${first.article_id}`,
    };
  } catch (err) {
    console.warn("[TecDoc] detalhe falhou:", err instanceof Error ? err.message : err);
    return null;
  }
}
