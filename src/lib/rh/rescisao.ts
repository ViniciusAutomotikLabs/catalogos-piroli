/**
 * Cálculo de rescisão (verbas rescisórias). Função pura.
 *
 * ATENÇÃO: estimativa simplificada para uso interno e conferência com o contador.
 * Não substitui o TRCT oficial. Sem eSocial no v1.
 */
import { round2 } from "./tabelas";

export type TipoRescisao =
  | "sem_justa_causa" // dispensa pelo empregador
  | "pedido_demissao" // iniciativa do empregado
  | "justa_causa" // falta grave do empregado
  | "acordo" // art. 484-A CLT
  | "fim_contrato"; // término de contrato por prazo

export type VerbaRescisoria = {
  descricao: string;
  valor: number;
  tipo: "provento" | "desconto";
};

export type EntradaRescisao = {
  salario: number;
  /** Dias trabalhados no mês do desligamento (saldo de salário). */
  diasTrabalhadosMes: number;
  /** Meses do período aquisitivo em curso (para férias proporcionais + 13º). */
  mesesProporcionais: number;
  /** Tem período de férias vencidas não gozadas? */
  temFeriasVencidas: boolean;
  tipo: TipoRescisao;
  avisoTipo?: "trabalhado" | "indenizado" | "dispensado";
  /** Saldo de FGTS para multa (informativo). 0 se desconhecido. */
  saldoFgts?: number;
};

export type ResultadoRescisao = {
  verbas: VerbaRescisoria[];
  totalProventos: number;
  totalDescontos: number;
  liquido: number;
};

/**
 * Calcula as principais verbas por tipo de rescisão. Regras (v1, simplificadas):
 * - Saldo de salário: sempre.
 * - Aviso prévio indenizado: só dispensa sem justa causa (indenizado).
 * - 13º proporcional: todos, exceto justa causa.
 * - Férias proporcionais + 1/3: todos, exceto justa causa.
 * - Férias vencidas + 1/3: todos (direito adquirido), inclusive justa causa.
 * - Multa FGTS: 40% (sem justa causa) / 20% (acordo), informativa.
 */
export function calcularRescisao(e: EntradaRescisao): ResultadoRescisao {
  const verbas: VerbaRescisoria[] = [];
  const salarioDia = e.salario / 30;
  const meses = Math.max(0, Math.min(12, e.mesesProporcionais));

  // Saldo de salário — sempre.
  const saldo = round2(salarioDia * Math.max(0, e.diasTrabalhadosMes));
  if (saldo > 0) verbas.push({ descricao: "Saldo de salário", valor: saldo, tipo: "provento" });

  const temIndenizacoes = e.tipo !== "justa_causa";
  const temProporcionais = e.tipo !== "justa_causa";

  // Aviso prévio indenizado — apenas dispensa sem justa causa.
  if (e.tipo === "sem_justa_causa" && e.avisoTipo === "indenizado") {
    verbas.push({ descricao: "Aviso prévio indenizado", valor: round2(e.salario), tipo: "provento" });
  }
  // Acordo (484-A): metade do aviso.
  if (e.tipo === "acordo") {
    verbas.push({ descricao: "Aviso prévio (50% — acordo)", valor: round2(e.salario / 2), tipo: "provento" });
  }

  // 13º proporcional.
  if (temProporcionais) {
    const decimo = round2((e.salario / 12) * meses);
    if (decimo > 0) verbas.push({ descricao: "13º salário proporcional", valor: decimo, tipo: "provento" });
  }

  // Férias proporcionais + 1/3.
  if (temProporcionais) {
    const feriasProp = (e.salario / 12) * meses;
    const total = round2(feriasProp + feriasProp / 3);
    if (total > 0)
      verbas.push({ descricao: "Férias proporcionais + 1/3", valor: total, tipo: "provento" });
  }

  // Férias vencidas + 1/3 — direito adquirido (todos os tipos).
  if (e.temFeriasVencidas) {
    verbas.push({
      descricao: "Férias vencidas + 1/3",
      valor: round2(e.salario + e.salario / 3),
      tipo: "provento",
    });
  }

  // Multa rescisória do FGTS (informativa).
  const saldoFgts = e.saldoFgts ?? 0;
  if (saldoFgts > 0 && temIndenizacoes) {
    const perc = e.tipo === "acordo" ? 0.2 : e.tipo === "sem_justa_causa" ? 0.4 : 0;
    if (perc > 0)
      verbas.push({
        descricao: `Multa FGTS ${perc * 100}% (informativa)`,
        valor: round2(saldoFgts * perc),
        tipo: "provento",
      });
  }

  const totalProventos = round2(
    verbas.filter((v) => v.tipo === "provento").reduce((s, v) => s + v.valor, 0)
  );
  const totalDescontos = round2(
    verbas.filter((v) => v.tipo === "desconto").reduce((s, v) => s + v.valor, 0)
  );

  return {
    verbas,
    totalProventos,
    totalDescontos,
    liquido: round2(totalProventos - totalDescontos),
  };
}
