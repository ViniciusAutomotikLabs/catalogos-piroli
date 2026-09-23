import { createClient } from "@/lib/supabase/server";
import { codigoExibicao, tituloExibicao } from "@/lib/produto-campos";

export type AgregadoItem = {
  id: number;
  produtoPrincipalId: number;
  produtoRelacionadoId: number | null;
  tipo: string;
  obrigatorio: boolean;
  quantidadeSugerida: number;
  ordem: number;
  observacao: string | null;
  codigo: string;
  titulo: string;
  fotoUrl: string | null;
  origemCatalogo: string;
  fabricante: string | null;
  preco?: number | null;
};

type RelacaoRow = {
  id: number;
  produto_principal_id: number;
  produto_relacionado_id: number;
  tipo: string;
  obrigatorio: boolean;
  quantidade_sugerida: number;
  ordem: number;
  observacao: string | null;
  relacionado: {
    id: number;
    codigo_principal: string | null;
    codigo_produto_interno: string;
    titulo_normalizado: string | null;
    descricao: string | null;
    foto_url: string | null;
    origem_catalogo: string;
    fabricantes: { nome_fabricante: string } | null;
  } | null;
};

function mapAgregado(row: RelacaoRow): AgregadoItem | null {
  const p = row.relacionado;
  if (!p) return null;
  return {
    id: row.id,
    produtoPrincipalId: row.produto_principal_id,
    produtoRelacionadoId: row.produto_relacionado_id,
    tipo: row.tipo,
    obrigatorio: row.obrigatorio,
    quantidadeSugerida: row.quantidade_sugerida,
    ordem: row.ordem,
    observacao: row.observacao,
    codigo: codigoExibicao(p),
    titulo: tituloExibicao(p),
    fotoUrl: p.foto_url,
    origemCatalogo: p.origem_catalogo,
    fabricante: p.fabricantes?.nome_fabricante ?? null,
  };
}

/** Busca agregados/kit ativos para uma lista de produtos principais. */
export async function listarAgregadosPorProdutos(
  produtoIds: number[]
): Promise<Map<number, AgregadoItem[]>> {
  const mapa = new Map<number, AgregadoItem[]>();
  if (produtoIds.length === 0) return mapa;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produto_relacoes")
    .select(
      `id, produto_principal_id, produto_relacionado_id, tipo, obrigatorio, quantidade_sugerida, ordem, observacao,
      relacionado:produtos!produto_relacionado_id(
        id, codigo_principal, codigo_produto_interno, titulo_normalizado, descricao, foto_url, origem_catalogo,
        fabricantes(nome_fabricante)
      )`
    )
    .in("produto_principal_id", produtoIds)
    .in("tipo", ["agregado", "kit"])
    .eq("ativo", true)
    .order("obrigatorio", { ascending: false })
    .order("ordem", { ascending: true });

  if (error || !data) return mapa;

  for (const row of data as RelacaoRow[]) {
    const item = mapAgregado(row);
    if (!item) continue;
    const lista = mapa.get(row.produto_principal_id) ?? [];
    lista.push(item);
    mapa.set(row.produto_principal_id, lista);
  }
  return mapa;
}

/** Agregados de um único produto principal. */
export async function listarAgregadosDoProduto(produtoId: number): Promise<AgregadoItem[]> {
  const mapa = await listarAgregadosPorProdutos([produtoId]);
  return mapa.get(produtoId) ?? [];
}

/** Converte agregados do espelho SS em AgregadoItem (para UI/busca). */
export function mapEspelhoAgregadosParaItens(
  codigoPrincipal: string,
  itens: Array<{
    codigoAgregado: string;
    quantidadeSugerida: number;
    ordem: number;
    descricao: string | null;
    preco: number;
  }>,
  produtoPrincipalId = 0
): AgregadoItem[] {
  return itens.map((a, i) => ({
    id: -(i + 1) - codigoPrincipal.length * 1000,
    produtoPrincipalId,
    produtoRelacionadoId: null,
    tipo: "agregado",
    obrigatorio: false,
    quantidadeSugerida: a.quantidadeSugerida,
    ordem: a.ordem,
    observacao: null,
    codigo: a.codigoAgregado,
    titulo: a.descricao?.trim() || a.codigoAgregado,
    fotoUrl: null,
    origemCatalogo: "ssplus",
    fabricante: null,
    preco: a.preco || null,
  }));
}
