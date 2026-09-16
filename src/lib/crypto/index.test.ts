import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

// Chaves de teste definidas ANTES de importar a lib (ela lê env em tempo de chamada,
// mas garantimos aqui a disponibilidade para todo o arquivo).
beforeAll(() => {
  process.env.ERP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.ERP_BLIND_INDEX_KEY = randomBytes(32).toString("base64");
});

import {
  blindIndexContato,
  blindIndexDocumento,
  cifrar,
  criptografiaConfigurada,
  decifrar,
  mascararDocumento,
  normalizarDocumento,
} from "./index";

describe("cifrar/decifrar (AES-256-GCM)", () => {
  it("faz roundtrip de um texto", () => {
    const original = "12.345.678/0001-90";
    const cifrado = cifrar(original);
    expect(cifrado).toMatch(/^\\x[0-9a-f]+$/);
    expect(decifrar(cifrado)).toBe(original);
  });

  it("gera ciphertext diferente a cada chamada (IV aleatório)", () => {
    const a = cifrar("mesmo valor");
    const b = cifrar("mesmo valor");
    expect(a).not.toBe(b);
    expect(decifrar(a)).toBe("mesmo valor");
    expect(decifrar(b)).toBe("mesmo valor");
  });

  it("trata null/vazio", () => {
    expect(cifrar(null)).toBeNull();
    expect(cifrar("")).toBeNull();
    expect(decifrar(null)).toBeNull();
  });

  it("detecta adulteração (tag GCM não confere)", () => {
    const cifrado = cifrar("segredo")!;
    // Flip do último byte do hex.
    const corrompido =
      cifrado.slice(0, -1) + (cifrado.slice(-1) === "0" ? "1" : "0");
    expect(() => decifrar(corrompido)).toThrow();
  });

  it("aceita hex sem prefixo \\x", () => {
    const cifrado = cifrar("abc")!;
    expect(decifrar(cifrado.slice(2))).toBe("abc");
  });
});

describe("blind index", () => {
  it("é determinístico para o mesmo documento (ignora máscara)", () => {
    const a = blindIndexDocumento("12.345.678/0001-90");
    const b = blindIndexDocumento("12345678000190");
    expect(a).toBe(b);
    expect(a).toMatch(/^\\x[0-9a-f]{64}$/); // HMAC-SHA256 = 32 bytes = 64 hex
  });

  it("muda para documentos diferentes", () => {
    expect(blindIndexDocumento("11111111111")).not.toBe(
      blindIndexDocumento("22222222222")
    );
  });

  it("não colide email x telefone com mesmo dígito base", () => {
    const email = blindIndexContato("teste@x.com", "email");
    const zap = blindIndexContato("teste@x.com", "whatsapp");
    expect(email).not.toBe(zap);
  });

  it("normaliza telefone (ignora formatação)", () => {
    expect(blindIndexContato("(67) 99811-7002", "whatsapp")).toBe(
      blindIndexContato("67998117002", "whatsapp")
    );
  });

  it("email é case-insensitive", () => {
    expect(blindIndexContato("A@B.com", "email")).toBe(
      blindIndexContato("a@b.com", "email")
    );
  });

  it("trata null/vazio", () => {
    expect(blindIndexDocumento(null)).toBeNull();
    expect(blindIndexContato("", "email")).toBeNull();
  });
});

describe("mascararDocumento", () => {
  it("mascara CPF", () => {
    expect(mascararDocumento("529.982.247-25")).toBe("***.***.247-25");
  });
  it("mascara CNPJ", () => {
    expect(mascararDocumento("12.345.678/0001-90")).toBe("**.***.***/0001-90");
  });
  it("fallback para tamanho inesperado", () => {
    expect(mascararDocumento("12345")).toBe("***2345");
  });
  it("trata null", () => {
    expect(mascararDocumento(null)).toBeNull();
  });
});

describe("normalizarDocumento / config", () => {
  it("remove não-dígitos", () => {
    expect(normalizarDocumento("12.345.678/0001-90")).toBe("12345678000190");
  });
  it("criptografiaConfigurada true com chaves setadas", () => {
    expect(criptografiaConfigurada()).toBe(true);
  });
});
