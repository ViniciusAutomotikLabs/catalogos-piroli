/**
 * Leitura do espelho operacional (saldo + preço) para Busca / Orçamento.
 * Fallback live GPASI só quando sync_legado_ativo e miss no espelho.
 */

import { createErpClient } from "@/lib/supabase/erp";
import { getContextoLoja } from "@/lib/loja";

export type EspelhoItem = {
  codigo: string;
  /** Código fabricante (part number SS) — usar na busca de catálogos. */
  codigoFabricante: string | null;
  marca: string | null;
  descricao: string | null;
  quantidade: number;
  reservado: number;
  disponivel: number;
  preco: number;
  precoAtacado: number | null;
  produtoId: number | null;
  unidadeId: number | null;
};

const ESPELHO_SELECT =
  "codigo, codigo_fabricante, marca, descricao, quantidade, reservado, preco, preco_atacado, produto_id, unidade_id";

function mapEspelhoRow(row: {
  codigo: string;
  codigo_fabricante?: string | null;
  marca?: string | null;
  descricao: string | null;
  quantidade: number | null;
  reservado: number | null;
  preco: number | null;
  preco_atacado: number | null;
  produto_id: number | null;
  unidade_id: number | null;
}): EspelhoItem {
  const qtd = Number(row.quantidade) || 0;
  const res = Number(row.reservado) || 0;
  return {
    codigo: String(row.codigo),
    codigoFabricante: row.codigo_fabricante
      ? String(row.codigo_fabricante).trim() || null
      : null,
    marca: row.marca ? String(row.marca).trim() || null : null,
    descricao: row.descricao,
    quantidade: qtd,
    reservado: res,
    disponivel: qtd - res,
    preco: Number(row.preco) || 0,
    precoAtacado: row.preco_atacado != null ? Number(row.preco_atacado) : null,
    produtoId: row.produto_id,
    unidadeId: row.unidade_id,
  };
}

/** Persiste identidade e/ou saldo local no espelho após enrich live. */
export async function atualizarEspelhoIdentidade(
  codigo: string,
  dados: {
    codigoFabricante?: string | null;
    marca?: string | null;
    descricao?: string | null;
    quantidade?: number | null;
    reservado?: number | null;
  }
): Promise<void> {
  const limpo = codigo.trim();
  if (!limpo) return;
  const patch: Record<string, string | number> = {};
  if (dados.codigoFabricante?.trim()) {
    patch.codigo_fabricante = dados.codigoFabricante.trim();
  }
  if (dados.marca?.trim()) patch.marca = dados.marca.trim();
  if (dados.descricao?.trim()) patch.descricao = dados.descricao.trim();
  if (dados.quantidade != null && Number.isFinite(dados.quantidade)) {
    patch.quantidade = dados.quantidade;
  }
  if (dados.reservado != null && Number.isFinite(dados.reservado)) {
    patch.reservado = dados.reservado;
  }
  if (Object.keys(patch).length === 0) return;

  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return;

  const sb = await createErpClient();
  await sb
    .from("estoque_saldos")
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("codigo", limpo);
}

export async function buscarEspelhoPorCodigos(
  codigos: string[]
): Promise<Map<string, EspelhoItem>> {
  const mapa = new Map<string, EspelhoItem>();
  const limpos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  if (limpos.length === 0) return mapa;

  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return mapa;

  const sb = await createErpClient();
  const { data } = await sb
    .from("estoque_saldos")
    .select(ESPELHO_SELECT)
    .eq("organizacao_id", contexto.organizacaoId)
    .in("codigo", limpos);

  for (const row of data ?? []) {
    mapa.set(String(row.codigo), mapEspelhoRow(row));
  }
  return mapa;
}

export async function buscarEspelhoPorProdutoIds(
  produtoIds: number[]
): Promise<Map<number, EspelhoItem>> {
  const mapa = new Map<number, EspelhoItem>();
  const ids = [...new Set(produtoIds.filter((n) => Number.isFinite(n)))];
  if (ids.length === 0) return mapa;

  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return mapa;

  const sb = await createErpClient();
  const { data } = await sb
    .from("estoque_saldos")
    .select(ESPELHO_SELECT)
    .eq("organizacao_id", contexto.organizacaoId)
    .in("produto_id", ids);

  for (const row of data ?? []) {
    if (row.produto_id == null) continue;
    const item = mapEspelhoRow(row);
    const atual = mapa.get(row.produto_id);
    if (!atual || item.disponivel > atual.disponivel) {
      mapa.set(row.produto_id, item);
    }
  }
  return mapa;
}

export type EspelhoAgregado = {
  codigoPrincipal: string;
  codigoAgregado: string;
  quantidadeSugerida: number;
  ordem: number;
  descricao: string | null;
  preco: number;
  quantidade: number;
};

/** Agregados SS Plus por código ERP (tabela estoque_agregados). */
export async function listarAgregadosEspelhoPorCodigos(
  codigos: string[]
): Promise<Map<string, EspelhoAgregado[]>> {
  const mapa = new Map<string, EspelhoAgregado[]>();
  const limpos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  if (limpos.length === 0) return mapa;

  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return mapa;

  const sb = await createErpClient();
  const { data: rels } = await sb
    .from("estoque_agregados")
    .select("codigo_principal, codigo_agregado, quantidade_sugerida, ordem")
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("ativo", true)
    .in("codigo_principal", limpos)
    .order("ordem", { ascending: true });

  if (!rels?.length) return mapa;

  const agregadosCodigos = [
    ...new Set(rels.map((r) => String(r.codigo_agregado)).filter(Boolean)),
  ];
  const saldos = await buscarEspelhoPorCodigos(agregadosCodigos);

  for (const row of rels) {
    const principal = String(row.codigo_principal);
    const agregado = String(row.codigo_agregado);
    const saldo = saldos.get(agregado);
    const lista = mapa.get(principal) ?? [];
    lista.push({
      codigoPrincipal: principal,
      codigoAgregado: agregado,
      quantidadeSugerida: Number(row.quantidade_sugerida) || 1,
      ordem: Number(row.ordem) || 0,
      descricao: saldo?.descricao ?? null,
      preco: saldo?.preco ?? 0,
      quantidade: saldo?.disponivel ?? 0,
    });
    mapa.set(principal, lista);
  }
  return mapa;
}

/** Lista paginada do espelho (menu Estoque). */
export async function listarEspelho(opts?: {
  termo?: string;
  limite?: number;
  pagina?: number;
}): Promise<{ itens: EspelhoItem[]; total: number; pagina: number; porPagina: number }> {
  const contexto = await getContextoLoja();
  const porPagina = Math.min(Math.max(opts?.limite ?? 50, 1), 200);
  const pagina = Math.max(opts?.pagina ?? 1, 1);
  if (!contexto?.organizacaoId) {
    return { itens: [], total: 0, pagina, porPagina };
  }

  const sb = await createErpClient();
  const from = (pagina - 1) * porPagina;
  const to = from + porPagina - 1;

  let q = sb
    .from("estoque_saldos")
    .select(ESPELHO_SELECT, { count: "exact" })
    .eq("organizacao_id", contexto.organizacaoId)
    .order("codigo")
    .range(from, to);

  const termo = opts?.termo?.trim();
  if (termo) {
    const safe = termo.replace(/[,()%]/g, " ").trim();
    if (safe) {
      q = q.or(
        `codigo.ilike.%${safe}%,codigo_fabricante.ilike.%${safe}%,descricao.ilike.%${safe}%,marca.ilike.%${safe}%`
      );
    }
  }

  const { data, count } = await q;
  const itens = (data ?? []).map(mapEspelhoRow);

  return { itens, total: count ?? 0, pagina, porPagina };
}

/** Um SKU do espelho por código ERP. */
export async function buscarEspelhoPorCodigo(
  codigo: string
): Promise<EspelhoItem | null> {
  const limpo = codigo.trim();
  if (!limpo) return null;
  const mapa = await buscarEspelhoPorCodigos([limpo]);
  return mapa.get(limpo) ?? null;
}
