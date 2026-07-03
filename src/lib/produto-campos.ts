/**
 * Helpers de exibição com fallback progressivo (campos normalizados → legado).
 */

import { parseDescricao, type DescricaoParse } from "./descricao-parser";

export type ProdutoCamposBase = {
  descricao?: string | null;
  descricao_original?: string | null;
  titulo_normalizado?: string | null;
  codigo_produto_interno: string;
  codigo_principal?: string | null;
  numero_produto?: string | null;
};

export function codigoExibicao(p: ProdutoCamposBase): string {
  return p.codigo_principal?.trim() || p.codigo_produto_interno;
}

export function descricaoOriginalExibicao(p: ProdutoCamposBase): string {
  return (p.descricao_original ?? p.descricao ?? "").trim();
}

export function tituloExibicao(p: ProdutoCamposBase): string {
  if (p.titulo_normalizado?.trim()) return p.titulo_normalizado.trim();
  return parseDescricao(p.descricao).titulo;
}

export function parseDescricaoComFallback(p: ProdutoCamposBase): DescricaoParse {
  const original = descricaoOriginalExibicao(p);
  const parsed = parseDescricao(original || p.descricao);
  if (p.titulo_normalizado?.trim()) {
    return { ...parsed, titulo: p.titulo_normalizado.trim() };
  }
  return parsed;
}

export type MatchTipo =
  | "codigo_exato"
  | "referencia_exata"
  | "codigo_normalizado"
  | "referencia_normalizada"
  | "texto";

export function labelMatchTipo(tipo: MatchTipo | string | null | undefined): string | null {
  switch (tipo) {
    case "codigo_exato":
      return "Código exato";
    case "referencia_exata":
      return "Via referência";
    case "codigo_normalizado":
      return "Código (normalizado)";
    case "referencia_normalizada":
      return "Referência (normalizada)";
    case "texto":
      return null;
    default:
      return null;
  }
}
