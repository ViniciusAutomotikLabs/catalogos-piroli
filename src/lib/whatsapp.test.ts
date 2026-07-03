import { describe, expect, it } from "vitest";
import {
  WHATSAPP_PADRAO,
  buildContatoLojaUrl,
  buildOrcamentoCodigos,
  buildOrcamentoMensagem,
  buildProdutoMensagem,
  buildWhatsAppUrl,
  normalizarTelefoneWhatsApp,
} from "./whatsapp";

describe("normalizarTelefoneWhatsApp", () => {
  it("adiciona DDI 55 quando ausente", () => {
    expect(normalizarTelefoneWhatsApp("61998117002")).toBe("5561998117002");
  });

  it("mantém DDI 55 quando já presente", () => {
    expect(normalizarTelefoneWhatsApp("5561998117002")).toBe("5561998117002");
  });

  it("remove caracteres não numéricos", () => {
    expect(normalizarTelefoneWhatsApp("+55 (61) 99811-7002")).toBe("5561998117002");
  });

  it("retorna vazio para entrada vazia", () => {
    expect(normalizarTelefoneWhatsApp(null)).toBe("");
    expect(normalizarTelefoneWhatsApp("")).toBe("");
  });
});

describe("buildWhatsAppUrl", () => {
  it("monta link com telefone normalizado e mensagem", () => {
    const url = buildWhatsAppUrl("Olá", "61998117002");
    expect(url).toBe(`https://wa.me/5561998117002?text=${encodeURIComponent("Olá")}`);
  });

  it("monta link só com mensagem quando telefone ausente", () => {
    const url = buildWhatsAppUrl("Olá");
    expect(url).toBe(`https://wa.me/?text=${encodeURIComponent("Olá")}`);
  });
});

describe("buildContatoLojaUrl", () => {
  it("usa telefone da loja quando informado", () => {
    expect(buildContatoLojaUrl("61998117002")).toBe("https://wa.me/5561998117002");
  });

  it("usa número padrão da plataforma quando loja sem telefone", () => {
    expect(buildContatoLojaUrl(null)).toBe(`https://wa.me/${WHATSAPP_PADRAO}`);
    expect(buildContatoLojaUrl("")).toBe(`https://wa.me/${WHATSAPP_PADRAO}`);
  });

  it("inclui mensagem opcional", () => {
    const url = buildContatoLojaUrl(null, "Suporte");
    expect(url).toBe(`https://wa.me/${WHATSAPP_PADRAO}?text=${encodeURIComponent("Suporte")}`);
  });
});

describe("buildProdutoMensagem", () => {
  it("monta mensagem com código e descrição", () => {
    const msg = buildProdutoMensagem(
      { descricao: "Filtro de óleo", codigo: "PH2870A" },
      false
    );
    expect(msg).toContain("Filtro de óleo");
    expect(msg).toContain("PH2870A");
    expect(msg).not.toContain("http");
  });

  it("inclui URL da foto quando solicitado", () => {
    const msg = buildProdutoMensagem(
      { descricao: "Peça", codigo: "123", fotoUrl: "https://cdn.example/foto.jpg" },
      true
    );
    expect(msg).toContain("https://cdn.example/foto.jpg");
  });
});

describe("buildOrcamentoMensagem", () => {
  it("calcula subtotal e validade padrão", () => {
    const msg = buildOrcamentoMensagem(
      [{ codigo: "A1", descricao: "Peça A", quantidade: 2, precoUnitario: 10 }],
      { clienteNome: "Oficina Silva" }
    );
    expect(msg).toContain("válido por 5 dias");
    expect(msg).toContain("Oficina Silva");
    expect(msg).toContain("R$");
    expect(msg).toContain("20,00");
  });
});

describe("buildOrcamentoCodigos", () => {
  it("agrupa quantidade no código quando > 1", () => {
    expect(
      buildOrcamentoCodigos([
        { codigo: "A1", quantidade: 1 },
        { codigo: "B2", quantidade: 3 },
      ])
    ).toBe("A1\nB2 (3x)");
  });
});
