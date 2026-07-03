import { describe, expect, it } from "vitest";
import { parseDescricao, tituloDescricao } from "./descricao-parser";

describe("parseDescricao — entradas vazias", () => {
  it("retorna fallback para null/undefined/vazio", () => {
    for (const v of [null, undefined, "", "   "]) {
      const r = parseDescricao(v);
      expect(r.titulo).toBe("Peça sem descrição");
      expect(r.codigos).toEqual([]);
      expect(r.alterado).toBe(false);
    }
  });
});

describe("parseDescricao — descrições limpas (não altera título)", () => {
  it("mantém descrição já boa", () => {
    const r = parseDescricao("Ssangyong Rexton 02 (2 filtros p/ emb.) AKX 3584 D");
    expect(r.titulo).toBe("Ssangyong Rexton 02 (2 filtros p/ emb.) AKX 3584 D");
    expect(r.codigos).toEqual([]);
  });

  it("normaliza apenas espaços redundantes", () => {
    const r = parseDescricao("  Filtro   de  Ar  ");
    expect(r.titulo).toBe("Filtro de Ar");
    expect(r.textoOriginal).toBe("Filtro de Ar");
  });
});

describe("parseDescricao — cabeçalho de tabela vazado", () => {
  it("remove 'CÓDIGO DESCRIÇÃO' do início", () => {
    const r = parseDescricao("CÓDIGO DESCRIÇÃO CONECTOR FILTRO RACOR - Ø 12 X M16 X 1,5");
    expect(r.titulo).toBe("CONECTOR FILTRO RACOR - Ø 12 X M16 X 1,5");
  });

  it("remove cabeçalho e extrai código principal solto", () => {
    const r = parseDescricao("CÓDIGO DESCRIÇÃO 1386677 CONECTOR FILTRO - Ø 12 X M16 X 1,5");
    expect(r.titulo).toBe("CONECTOR FILTRO - Ø 12 X M16 X 1,5");
    expect(r.codigos).toContain("1386677");
  });
});

describe("parseDescricao — leaders de índice (pontos + página)", () => {
  it("remove pontilhado e número de página", () => {
    const r = parseDescricao(
      "KIT DE FILTROS PARA INJETOR .......................................................................... 102"
    );
    expect(r.titulo).toBe("KIT DE FILTROS PARA INJETOR");
  });

  it("remove leaders no meio da string", () => {
    const r = parseDescricao("PRÉ DA BOMBA E MÓDULO DE COMBUSTÍVEL ............................................. 104");
    expect(r.titulo).toBe("PRÉ DA BOMBA E MÓDULO DE COMBUSTÍVEL");
  });
});

describe("parseDescricao — numeração de lista no início", () => {
  it("remove '2.' com espaço", () => {
    expect(tituloDescricao("2. JUNTA FILTRO DE ACEITE")).toBe("JUNTA FILTRO DE ACEITE");
  });

  it("remove '2.' sem espaço (colado no texto)", () => {
    expect(tituloDescricao("2.JUNTA FILTRO DE ACEITE")).toBe("JUNTA FILTRO DE ACEITE");
  });

  it("não remove medida decimal '2.0 TDI'", () => {
    expect(tituloDescricao("2.0 TDI FILTRO")).toBe("2.0 TDI FILTRO");
  });

  it("remove '240.'", () => {
    expect(tituloDescricao("240. Filtro de combustível da CG125/CG150/YBR125 10")).toBe(
      "Filtro de combustível da CG125/CG150/YBR125 10"
    );
  });

  it("remove prefixo '.010'", () => {
    expect(tituloDescricao(".010 Filtro de combustível da CG125/CG150/YBR125 10")).toBe(
      "Filtro de combustível da CG125/CG150/YBR125 10"
    );
  });
});

describe("parseDescricao — códigos COD:", () => {
  it("extrai múltiplos COD: e limpa o título", () => {
    const r = parseDescricao(
      "RANDON COD: 537 COD: 2456 COD: 641 COD: 533 BAL TR CAVALO RANDON Ø50 0008/00018 BAL CAR RANDON MOD ATE 1984 Ø60 COD: 1"
    );
    expect(r.codigos).toEqual(["537", "2456", "641", "533", "1"]);
    expect(r.titulo).toContain("BAL TR CAVALO RANDON");
    expect(r.titulo).not.toContain("COD:");
  });

  it("não duplica códigos repetidos", () => {
    const r = parseDescricao("FILTRO COD: 10 COD: 10 DE AR");
    expect(r.codigos).toEqual(["10"]);
  });
});

describe("parseDescricao — casos degenerados", () => {
  it("usa código como título quando sobra vazio", () => {
    const r = parseDescricao("COD: 998877");
    expect(r.titulo).toBe("998877");
    expect(r.codigos).toEqual(["998877"]);
  });

  it("preserva sempre o texto original", () => {
    const bruto = "CÓDIGO DESCRIÇÃO 1386677 CONECTOR FILTRO";
    expect(parseDescricao(bruto).textoOriginal).toBe(bruto);
  });
});
