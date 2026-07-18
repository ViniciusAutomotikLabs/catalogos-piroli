import { describe, expect, it } from "vitest";
import { inferirFiltrosPostgREST, _test } from "./tecdoc-termos";
import { dedupPorArticleId, tecdocSyntheticId, mapTecDocItem } from "./tecdoc-catalog";

describe("inferirFiltrosPostgREST", () => {
  it("retorna vazio para termo curto", () => {
    expect(inferirFiltrosPostgREST("a")).toEqual([]);
    expect(inferirFiltrosPostgREST("")).toEqual([]);
  });

  it("mapeia peça PT para description EN", () => {
    const f = inferirFiltrosPostgREST("filtro");
    expect(f).toEqual([{ campo: "description", valor: "Oil Filter" }]);
  });

  it("mapeia amortecedor e pastilha", () => {
    expect(inferirFiltrosPostgREST("amortecedor")[0]).toEqual({
      campo: "description",
      valor: "Shock Absorber",
    });
    expect(inferirFiltrosPostgREST("pastilha")[0]).toEqual({
      campo: "description",
      valor: "Brake Pad",
    });
  });

  it("prioriza model_name para veículos conhecidos", () => {
    const f = inferirFiltrosPostgREST("Gol");
    expect(f).toEqual([{ campo: "model_name", valor: "Gol" }]);
  });

  it("trata código como description", () => {
    const f = inferirFiltrosPostgREST("201.0813");
    expect(f[0]?.campo).toBe("description");
    expect(f[0]?.valor).toBe("201.0813");
  });

  it("fallback genérico usa description e model_name", () => {
    const f = inferirFiltrosPostgREST("xyzabcdesconhecido");
    expect(f.length).toBe(2);
    expect(f.map((x) => x.campo).sort()).toEqual(["description", "model_name"]);
  });
});

describe("dedupPorArticleId", () => {
  it("agrega aplicações e remove duplicatas", () => {
    const rows = dedupPorArticleId([
      {
        article_id: 10,
        description: "Oil Filter",
        model_name: "MARRUÁ Pickup",
        vehicle_desc: "2.8",
        image_url: "http://a.webp",
      },
      {
        article_id: 10,
        description: "Oil Filter",
        model_name: "MARRUÁ",
        vehicle_desc: null,
        image_url: null,
      },
      {
        article_id: 11,
        description: "Air Filter",
        model_name: "Gol",
        vehicle_desc: "1.0",
        image_url: null,
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].aplicacoes).toContain("MARRUÁ Pickup 2.8");
    expect(rows[0].aplicacoes).toContain("MARRUÁ");
    expect(rows[0].image_url).toBe("http://a.webp");
  });
});

describe("tecdocSyntheticId / mapTecDocItem", () => {
  it("gera id negativo", () => {
    expect(tecdocSyntheticId(42)).toBe(-42);
  });

  it("mapeia item com codigo TecDoc", () => {
    const item = mapTecDocItem({
      article_id: 30,
      description: "Brake Fluid",
      model_name: "GOLF I",
      vehicle_desc: "1.6",
      image_url: null,
      aplicacoes: ["GOLF I 1.6"],
    });
    expect(item.codigo).toBe("TecDoc-30");
    expect(item.vehicleContext).toBe("GOLF I 1.6");
  });
});

describe("_test.pareceCodigo", () => {
  it("detecta códigos", () => {
    expect(_test.pareceCodigo("1386677")).toBe(true);
    expect(_test.pareceCodigo("PH2870A")).toBe(true);
    expect(_test.pareceCodigo("filtro")).toBe(false);
  });
});
