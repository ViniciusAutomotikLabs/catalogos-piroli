import { describe, expect, it } from "vitest";
import { calcularFerias, calcularDecimoTerceiro } from "./ferias";

describe("calcularFerias", () => {
  it("30 dias sem abono = salário + 1/3", () => {
    const r = calcularFerias(3000, 30, 0);
    expect(r.valorDias).toBeCloseTo(3000, 2);
    expect(r.valorAbono).toBe(0);
    expect(r.tercoConstitucional).toBeCloseTo(1000, 2);
    expect(r.total).toBeCloseTo(4000, 2);
  });

  it("20 dias de gozo + 10 de abono", () => {
    const r = calcularFerias(3000, 20, 10);
    // dias: 100*20=2000 ; abono: 100*10=1000 ; 1/3 sobre 3000 = 1000
    expect(r.valorDias).toBeCloseTo(2000, 2);
    expect(r.valorAbono).toBeCloseTo(1000, 2);
    expect(r.tercoConstitucional).toBeCloseTo(1000, 2);
    expect(r.total).toBeCloseTo(4000, 2);
  });

  it("dias negativos são tratados como zero", () => {
    const r = calcularFerias(3000, -5, 0);
    expect(r.valorDias).toBe(0);
  });
});

describe("calcularDecimoTerceiro", () => {
  it("integral proporcional a 12 meses = salário cheio", () => {
    expect(calcularDecimoTerceiro(3000, 12, "integral")).toBeCloseTo(3000, 2);
  });
  it("proporcional a 6 meses = metade", () => {
    expect(calcularDecimoTerceiro(3000, 6, "integral")).toBeCloseTo(1500, 2);
  });
  it("primeira parcela = metade do proporcional", () => {
    expect(calcularDecimoTerceiro(3000, 12, 1)).toBeCloseTo(1500, 2);
  });
  it("limita meses a 12 e não aceita negativos", () => {
    expect(calcularDecimoTerceiro(3000, 20, "integral")).toBeCloseTo(3000, 2);
    expect(calcularDecimoTerceiro(3000, -3, "integral")).toBe(0);
  });
});
