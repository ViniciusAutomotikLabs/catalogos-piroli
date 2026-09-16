/**
 * Tabelas legais (INSS, IRRF, salário-família, FGTS, salário mínimo) do módulo RH.
 *
 * As tabelas são NACIONAIS e configuráveis por ano em `rh_tabelas_legais` (jsonb).
 * O cálculo (folha.ts, ferias.ts, rescisao.ts) é PURO: recebe estas estruturas como
 * parâmetro, nunca lê o banco. Isso mantém tudo testável sem I/O e permite atualizar
 * as faixas todo ano sem tocar no código.
 */

export type FaixaINSS = { ate: number; aliquota: number };
export type TabelaINSS = { faixas: FaixaINSS[]; teto: number };

export type FaixaIRRF = { ate: number | null; aliquota: number; deducao: number };
export type TabelaIRRF = {
  faixas: FaixaIRRF[];
  deducao_dependente: number;
  desconto_simplificado: number;
};

export type TabelaSalarioFamilia = { teto_salario: number; valor_cota: number };
export type TabelaFGTS = { aliquota: number };
export type TabelaSalarioMinimo = { valor: number };

export type TipoTabelaLegal =
  | "inss"
  | "irrf"
  | "salario_familia"
  | "fgts"
  | "salario_minimo";

export type LinhaTabelaLegal = {
  vigencia_ano: number;
  tipo: TipoTabelaLegal;
  faixas: unknown;
};

/**
 * Conjunto de tabelas resolvido para um ano. Campos podem faltar se o seed não
 * tiver o tipo; o chamador decide o fallback.
 */
export type TabelasLegais = {
  ano: number;
  inss?: TabelaINSS;
  irrf?: TabelaIRRF;
  salarioFamilia?: TabelaSalarioFamilia;
  fgts?: TabelaFGTS;
  salarioMinimo?: TabelaSalarioMinimo;
};

/** Agrupa as linhas cruas de `rh_tabelas_legais` em um objeto tipado. */
export function montarTabelasLegais(
  ano: number,
  linhas: LinhaTabelaLegal[]
): TabelasLegais {
  const out: TabelasLegais = { ano };
  for (const l of linhas) {
    switch (l.tipo) {
      case "inss":
        out.inss = l.faixas as TabelaINSS;
        break;
      case "irrf":
        out.irrf = l.faixas as TabelaIRRF;
        break;
      case "salario_familia":
        out.salarioFamilia = l.faixas as TabelaSalarioFamilia;
        break;
      case "fgts":
        out.fgts = l.faixas as TabelaFGTS;
        break;
      case "salario_minimo":
        out.salarioMinimo = l.faixas as TabelaSalarioMinimo;
        break;
    }
  }
  return out;
}

/** Arredonda para 2 casas (centavos), evitando erros de ponto flutuante. */
export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
