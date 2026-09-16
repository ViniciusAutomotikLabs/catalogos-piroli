/**
 * Cálculo de férias e 13º salário. Funções puras (sem I/O).
 */
import { round2 } from "./tabelas";

export type ResultadoFerias = {
  /** Valor dos dias de gozo (salário/30 * dias). */
  valorDias: number;
  /** Abono pecuniário: dias vendidos (até 10) convertidos em dinheiro. */
  valorAbono: number;
  /** 1/3 constitucional sobre gozo + abono. */
  tercoConstitucional: number;
  /** Total bruto (gozo + abono + 1/3). */
  total: number;
};

/**
 * Férias: valor dos dias de gozo + abono pecuniário (venda de até 10 dias) + 1/3
 * constitucional sobre ambos. Valor bruto (descontos de INSS/IRRF, quando aplicáveis,
 * entram na folha). `salario` é o salário mensal cheio.
 */
export function calcularFerias(
  salario: number,
  dias: number,
  abonoDias = 0
): ResultadoFerias {
  const valorDiario = salario / 30;
  const valorDias = round2(valorDiario * Math.max(0, dias));
  const valorAbono = round2(valorDiario * Math.max(0, abonoDias));
  const tercoConstitucional = round2((valorDias + valorAbono) / 3);
  return {
    valorDias,
    valorAbono,
    tercoConstitucional,
    total: round2(valorDias + valorAbono + tercoConstitucional),
  };
}

export type ParcelaDecimo = 1 | 2 | "integral";

/**
 * 13º salário proporcional aos meses trabalhados no ano (mês com 15+ dias conta).
 * - parcela 1: metade (adiantamento, sem descontos);
 * - parcela 2: metade restante (descontos de INSS/IRRF entram na folha);
 * - integral: valor cheio proporcional.
 */
export function calcularDecimoTerceiro(
  salario: number,
  mesesTrabalhados: number,
  parcela: ParcelaDecimo = "integral"
): number {
  const meses = Math.max(0, Math.min(12, Math.floor(mesesTrabalhados)));
  const proporcional = round2((salario / 12) * meses);
  if (parcela === "integral") return proporcional;
  return round2(proporcional / 2);
}
