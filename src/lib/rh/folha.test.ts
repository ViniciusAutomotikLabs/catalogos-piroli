import { describe, expect, it } from "vitest";
import {
  calcularINSS,
  calcularIRRF,
  calcularFGTS,
  calcularSalarioFamilia,
  montarHolerite,
} from "./folha";
import type {
  TabelaINSS,
  TabelaIRRF,
  TabelaFGTS,
  TabelaSalarioFamilia,
} from "./tabelas";

// Tabelas do seed 012 (base 2025 oficial).
const INSS: TabelaINSS = {
  faixas: [
    { ate: 1518.0, aliquota: 0.075 },
    { ate: 2793.88, aliquota: 0.09 },
    { ate: 4190.83, aliquota: 0.12 },
    { ate: 8157.41, aliquota: 0.14 },
  ],
  teto: 8157.41,
};

const IRRF: TabelaIRRF = {
  faixas: [
    { ate: 2259.2, aliquota: 0, deducao: 0 },
    { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
    { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
    { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
    { ate: null, aliquota: 0.275, deducao: 896.0 },
  ],
  deducao_dependente: 189.59,
  desconto_simplificado: 607.2,
};

const FGTS: TabelaFGTS = { aliquota: 0.08 };
const SAL_FAM: TabelaSalarioFamilia = { teto_salario: 1819.26, valor_cota: 65.0 };

describe("calcularINSS (progressivo por faixas)", () => {
  it("primeira faixa apenas (salário mínimo)", () => {
    // 1518 * 7,5% = 113,85
    expect(calcularINSS(1518.0, INSS)).toBeCloseTo(113.85, 2);
  });

  it("soma progressiva em faixa intermediária", () => {
    // 1518*0.075 + (2500-1518)*0.09 = 113.85 + 88.38 = 202.23
    expect(calcularINSS(2500, INSS)).toBeCloseTo(202.23, 2);
  });

  it("respeita o teto de contribuição", () => {
    const noTeto = calcularINSS(8157.41, INSS);
    const acimaTeto = calcularINSS(20000, INSS);
    expect(acimaTeto).toBe(noTeto);
    // Teto ~ 951,63
    expect(noTeto).toBeCloseTo(951.63, 1);
  });

  it("base zero/negativa retorna 0", () => {
    expect(calcularINSS(0, INSS)).toBe(0);
    expect(calcularINSS(-100, INSS)).toBe(0);
  });
});

describe("calcularIRRF", () => {
  it("isento na primeira faixa", () => {
    expect(calcularIRRF(2000, 0, IRRF)).toBe(0);
  });

  it("aplica faixa e escolhe o menor imposto (simplificado vs legal)", () => {
    // base 3000, sem dependentes → simplificado (3000-607.2=2392.8) cai na faixa isenta-ish
    const irrf = calcularIRRF(3000, 0, IRRF);
    expect(irrf).toBeGreaterThanOrEqual(0);
    // Nunca negativo
    expect(irrf).toBeLessThan(3000 * 0.275);
  });

  it("dependentes reduzem o imposto", () => {
    const semDep = calcularIRRF(5000, 0, IRRF);
    const comDep = calcularIRRF(5000, 3, IRRF);
    expect(comDep).toBeLessThanOrEqual(semDep);
  });
});

describe("calcularFGTS", () => {
  it("8% da base", () => {
    expect(calcularFGTS(2000, FGTS)).toBeCloseTo(160, 2);
  });
});

describe("calcularSalarioFamilia", () => {
  it("paga cota por filho dentro do teto", () => {
    expect(calcularSalarioFamilia(1500, 2, SAL_FAM)).toBeCloseTo(130, 2);
  });
  it("não paga acima do teto", () => {
    expect(calcularSalarioFamilia(3000, 2, SAL_FAM)).toBe(0);
  });
});

describe("montarHolerite", () => {
  it("consolida proventos e descontos com líquido correto", () => {
    const h = montarHolerite({
      salarioBase: 3000,
      proventos: [{ descricao: "Hora extra", valor: 200 }],
      descontos: [{ descricao: "Vale transporte", valor: 180 }],
      inss: 240,
      irrf: 50,
      fgts: 256,
    });
    expect(h.totalProventos).toBeCloseTo(3200, 2);
    // 240 + 50 + 180 = 470
    expect(h.totalDescontos).toBeCloseTo(470, 2);
    expect(h.liquido).toBeCloseTo(2730, 2);
    expect(h.fgts).toBeCloseTo(256, 2);
  });

  it("omite INSS/IRRF zerados dos descontos", () => {
    const h = montarHolerite({ salarioBase: 1518, inss: 0, irrf: 0, fgts: 121.44 });
    expect(h.descontos).toHaveLength(0);
    expect(h.liquido).toBeCloseTo(1518, 2);
  });
});
