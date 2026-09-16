import { describe, expect, it } from "vitest";
import { calcularRescisao } from "./rescisao";

describe("calcularRescisao", () => {
  it("dispensa sem justa causa: aviso indenizado + multa 40%", () => {
    const r = calcularRescisao({
      salario: 3000,
      diasTrabalhadosMes: 30,
      mesesProporcionais: 6,
      temFeriasVencidas: false,
      tipo: "sem_justa_causa",
      avisoTipo: "indenizado",
      saldoFgts: 5000,
    });
    const desc = r.verbas.map((v) => v.descricao);
    expect(desc).toContain("Saldo de salário");
    expect(desc).toContain("Aviso prévio indenizado");
    expect(desc).toContain("13º salário proporcional");
    expect(desc).toContain("Férias proporcionais + 1/3");
    expect(desc.some((d) => d.startsWith("Multa FGTS 40"))).toBe(true);
    expect(r.liquido).toBeGreaterThan(0);
  });

  it("justa causa: só saldo + férias vencidas, sem proporcionais nem multa", () => {
    const r = calcularRescisao({
      salario: 3000,
      diasTrabalhadosMes: 15,
      mesesProporcionais: 6,
      temFeriasVencidas: true,
      tipo: "justa_causa",
      saldoFgts: 5000,
    });
    const desc = r.verbas.map((v) => v.descricao);
    expect(desc).toContain("Saldo de salário");
    expect(desc).toContain("Férias vencidas + 1/3");
    expect(desc).not.toContain("13º salário proporcional");
    expect(desc.some((d) => d.startsWith("Multa FGTS"))).toBe(false);
  });

  it("pedido de demissão: sem aviso indenizado e sem multa", () => {
    const r = calcularRescisao({
      salario: 3000,
      diasTrabalhadosMes: 30,
      mesesProporcionais: 3,
      temFeriasVencidas: false,
      tipo: "pedido_demissao",
      saldoFgts: 5000,
    });
    const desc = r.verbas.map((v) => v.descricao);
    expect(desc).not.toContain("Aviso prévio indenizado");
    expect(desc.some((d) => d.startsWith("Multa FGTS"))).toBe(false);
    expect(desc).toContain("13º salário proporcional");
  });

  it("acordo (484-A): metade do aviso e multa 20%", () => {
    const r = calcularRescisao({
      salario: 3000,
      diasTrabalhadosMes: 30,
      mesesProporcionais: 6,
      temFeriasVencidas: false,
      tipo: "acordo",
      saldoFgts: 5000,
    });
    const desc = r.verbas.map((v) => v.descricao);
    expect(desc.some((d) => d.includes("50%"))).toBe(true);
    expect(desc.some((d) => d.startsWith("Multa FGTS 20"))).toBe(true);
  });
});
