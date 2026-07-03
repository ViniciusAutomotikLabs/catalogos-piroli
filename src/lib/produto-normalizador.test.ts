import { describe, expect, it } from "vitest";
import { codigoConfiavel, normalizarProduto } from "./produto-normalizador";

describe("codigoConfiavel", () => {
  it("rejeita palavras de tipo de peça", () => {
    expect(codigoConfiavel("RACOR")).toBe(false);
    expect(codigoConfiavel("FILTRO")).toBe(false);
    expect(codigoConfiavel("M16")).toBe(false);
  });

  it("aceita códigos numéricos ou alfanuméricos com dígitos", () => {
    expect(codigoConfiavel("1386677")).toBe(true);
    expect(codigoConfiavel("201.0813")).toBe(true);
    expect(codigoConfiavel("AKX3584")).toBe(true);
  });
});

describe("normalizarProduto — exemplos do handoff", () => {
  it("BE-01: cabeçalho vazado + código na descrição", () => {
    const r = normalizarProduto({
      descricao: "CÓDIGO DESCRIÇÃO 1386677 CONECTOR FILTRO - Ø 12 X M16 X 1,5",
      codigo_produto_interno: "RACOR",
    });

    expect(r.descricao_original).toContain("1386677");
    expect(r.titulo_normalizado).toBe("CONECTOR FILTRO - Ø 12 X M16 X 1,5");
    expect(r.codigo_principal).toBe("1386677");
    expect(r.codigos_extraidos).toContain("1386677");
    expect(r.medidas_extraidas.length).toBeGreaterThan(0);
    expect(r.corrigir_codigo_interno).toBe(true);
    expect(r.codigo_produto_interno_anterior).toBe("RACOR");
    expect(r.normalizacao_status).toBe("ok");
  });

  it("BE-01: múltiplos COD: → parcial/revisar", () => {
    const r = normalizarProduto({
      descricao: "RANDON COD: 537 COD: 2456 COD: 641 BAL TR CAVALO RANDON Ø50",
      codigo_produto_interno: "BAL",
    });

    expect(r.codigos_extraidos).toEqual(expect.arrayContaining(["537", "2456", "641"]));
    expect(r.titulo_normalizado).not.toContain("COD:");
    expect(["parcial", "revisar"]).toContain(r.normalizacao_status);
    expect(r.aplicacao_resumo).toBeTruthy();
  });

  it("preserva descrição original integralmente", () => {
    const bruto = "KIT DE FILTROS ........ 102";
    const r = normalizarProduto({
      descricao: bruto,
      codigo_produto_interno: "102",
    });
    expect(r.descricao_original).toBe(bruto);
    expect(r.titulo_normalizado).toBe("KIT DE FILTROS");
  });

  it("não corrige código interno quando já confiável", () => {
    const r = normalizarProduto({
      descricao: "Filtro de ar motor",
      codigo_produto_interno: "2010813",
    });
    expect(r.codigo_principal).toBe("2010813");
    expect(r.corrigir_codigo_interno).toBe(false);
    expect(r.normalizacao_status).toBe("ok");
  });
});
