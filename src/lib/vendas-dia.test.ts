import { describe, expect, it } from "vitest";
import { boundsDiaSp, nomeCliente, unwrapOne } from "./vendas-dia";

describe("boundsDiaSp", () => {
  it("mapeia dia civil SP para [03:00Z, 03:00Z+1d)", () => {
    const { inicio, fim } = boundsDiaSp("2026-09-23");
    expect(inicio).toBe("2026-09-23T03:00:00.000Z");
    expect(fim).toBe("2026-09-24T03:00:00.000Z");
  });

  it("atravessa virada de mês", () => {
    const { inicio, fim } = boundsDiaSp("2026-01-31");
    expect(inicio).toBe("2026-01-31T03:00:00.000Z");
    expect(fim).toBe("2026-02-01T03:00:00.000Z");
  });

  it("atravessa virada de ano", () => {
    const { fim } = boundsDiaSp("2026-12-31");
    expect(fim).toBe("2027-01-01T03:00:00.000Z");
  });

  it("dia inválido cai no hoje SP (formato YYYY-MM-DD)", () => {
    const { inicio, fim } = boundsDiaSp("não-é-data");
    expect(inicio).toMatch(/^\d{4}-\d{2}-\d{2}T03:00:00.000Z$/);
    expect(fim).toMatch(/^\d{4}-\d{2}-\d{2}T03:00:00.000Z$/);
    expect(new Date(fim).getTime() - new Date(inicio).getTime()).toBe(
      24 * 60 * 60 * 1000
    );
  });
});

describe("unwrapOne", () => {
  it("retorna null para vazio", () => {
    expect(unwrapOne(null)).toBeNull();
    expect(unwrapOne(undefined)).toBeNull();
    expect(unwrapOne([])).toBeNull();
  });

  it("desembrulha array Supabase embed", () => {
    expect(unwrapOne([{ nome: "A" }])).toEqual({ nome: "A" });
  });

  it("mantém objeto único", () => {
    expect(unwrapOne({ nome: "B" })).toEqual({ nome: "B" });
  });
});

describe("nomeCliente", () => {
  it("prioriza nome_fantasia do cliente", () => {
    expect(
      nomeCliente({
        clientes: { razao_social: "Razão LTDA", nome_fantasia: "Fantasia" },
      })
    ).toBe("Fantasia");
  });

  it("aceita embed como array", () => {
    expect(
      nomeCliente({
        clientes: [{ razao_social: "Só Razão", nome_fantasia: null }],
      })
    ).toBe("Só Razão");
  });

  it("cai para pessoa quando sem cliente", () => {
    expect(
      nomeCliente({
        pessoas: { nome: "João", nome_fantasia: null },
      })
    ).toBe("João");
  });

  it("retorna traço sem nomes", () => {
    expect(nomeCliente({})).toBe("—");
    expect(nomeCliente({ clientes: null, pessoas: [] })).toBe("—");
  });
});
