/**
 * Cálculo de folha (INSS/IRRF/FGTS/salário-família) e montagem do holerite.
 *
 * Funções PURAS: recebem as tabelas legais como parâmetro (ver tabelas.ts). Todos os
 * valores são estimativas para uso interno/holerite; a apuração oficial é do contador
 * (sem eSocial no v1).
 */
import {
  round2,
  type TabelaINSS,
  type TabelaIRRF,
  type TabelaFGTS,
  type TabelaSalarioFamilia,
} from "./tabelas";

/**
 * INSS progressivo: cada faixa incide só sobre a parcela dentro dela, respeitando o
 * teto. Retorna o valor da contribuição (desconto).
 */
export function calcularINSS(base: number, tabela: TabelaINSS): number {
  if (base <= 0) return 0;
  const baseLimitada = Math.min(base, tabela.teto);
  let contrib = 0;
  let pisoAnterior = 0;
  for (const faixa of tabela.faixas) {
    const topo = Math.min(baseLimitada, faixa.ate);
    if (topo > pisoAnterior) {
      contrib += (topo - pisoAnterior) * faixa.aliquota;
      pisoAnterior = topo;
    }
    if (baseLimitada <= faixa.ate) break;
  }
  return round2(contrib);
}

/** Aplica uma base já deduzida contra as faixas do IRRF. Nunca negativo. */
function impostoIRRFPorBase(base: number, tabela: TabelaIRRF): number {
  if (base <= 0) return 0;
  for (const faixa of tabela.faixas) {
    if (faixa.ate === null || base <= faixa.ate) {
      return Math.max(0, round2(base * faixa.aliquota - faixa.deducao));
    }
  }
  return 0;
}

/**
 * IRRF sobre a base (já líquida de INSS). Compara o modelo com deduções legais
 * (dependentes) contra o desconto simplificado e devolve o MENOR imposto — como a
 * legislação faculta ao contribuinte.
 */
export function calcularIRRF(
  baseAposInss: number,
  numDependentes: number,
  tabela: TabelaIRRF
): number {
  const baseComDependentes =
    baseAposInss - tabela.deducao_dependente * Math.max(0, numDependentes);
  const baseSimplificada = baseAposInss - tabela.desconto_simplificado;
  const impostoLegal = impostoIRRFPorBase(baseComDependentes, tabela);
  const impostoSimpl = impostoIRRFPorBase(baseSimplificada, tabela);
  return Math.min(impostoLegal, impostoSimpl);
}

/** FGTS (8% padrão): informativo — a empresa recolhe fora do sistema. */
export function calcularFGTS(base: number, tabela: TabelaFGTS): number {
  if (base <= 0) return 0;
  return round2(base * tabela.aliquota);
}

/** Salário-família: cota por filho elegível, se o salário estiver dentro do teto. */
export function calcularSalarioFamilia(
  salarioBase: number,
  filhosElegiveis: number,
  tabela: TabelaSalarioFamilia
): number {
  if (salarioBase > tabela.teto_salario || filhosElegiveis <= 0) return 0;
  return round2(tabela.valor_cota * filhosElegiveis);
}

// ===== Holerite =====

export type Rubrica = { descricao: string; valor: number };

export type EntradaHolerite = {
  salarioBase: number;
  /** Proventos adicionais lançados manualmente (h. extra, comissão, etc.). */
  proventos?: Rubrica[];
  /** Descontos adicionais lançados manualmente (vale, adiantamento, etc.). */
  descontos?: Rubrica[];
  inss: number;
  irrf: number;
  fgts: number;
};

export type Holerite = {
  proventos: Rubrica[];
  descontos: Rubrica[];
  totalProventos: number;
  totalDescontos: number;
  liquido: number;
  fgts: number;
};

/**
 * Consolida salário + proventos manuais como créditos e INSS/IRRF + descontos manuais
 * como débitos, retornando as listas e os totais para exibição/PDF do holerite.
 */
export function montarHolerite(entrada: EntradaHolerite): Holerite {
  const proventos: Rubrica[] = [
    { descricao: "Salário base", valor: round2(entrada.salarioBase) },
    ...(entrada.proventos ?? []),
  ];
  const descontos: Rubrica[] = [];
  if (entrada.inss > 0) descontos.push({ descricao: "INSS", valor: round2(entrada.inss) });
  if (entrada.irrf > 0) descontos.push({ descricao: "IRRF", valor: round2(entrada.irrf) });
  descontos.push(...(entrada.descontos ?? []));

  const totalProventos = round2(proventos.reduce((s, r) => s + r.valor, 0));
  const totalDescontos = round2(descontos.reduce((s, r) => s + r.valor, 0));

  return {
    proventos,
    descontos,
    totalProventos,
    totalDescontos,
    liquido: round2(totalProventos - totalDescontos),
    fgts: round2(entrada.fgts),
  };
}
