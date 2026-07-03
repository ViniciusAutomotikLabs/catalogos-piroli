/**
 * Pipeline backend de normalização de produtos importados de catálogo.
 * Reutiliza o parser de apresentação e adiciona regras de confiança para
 * código principal, medidas, aplicação e status de revisão.
 */

import { parseDescricao } from "./descricao-parser";

export type NormalizacaoStatus = "ok" | "parcial" | "revisar";

export type ProdutoNormalizado = {
  descricao_original: string;
  titulo_normalizado: string;
  codigo_principal: string;
  codigos_extraidos: string[];
  medidas_extraidas: string[];
  aplicacao_resumo: string | null;
  normalizacao_status: NormalizacaoStatus;
  /** Quando confiança alta, corrige codigo_produto_interno e guarda o anterior. */
  corrigir_codigo_interno: boolean;
  codigo_produto_interno_anterior: string | null;
  codigo_produto_interno_novo: string | null;
};

/** Palavras/tokens que costumam aparecer como código mas são tipo de peça ou medida. */
const CODIGOS_SUSPEITOS = new Set([
  "racor", "filtro", "junta", "bal", "conector", "kit", "oleo", "óleo",
  "ar", "combustivel", "combustível", "vedacao", "vedação", "retentor",
  "parafuso", "porca", "anel", "mangueira", "bucha", "pino", "rolamento",
  "m8", "m10", "m12", "m14", "m16", "m18", "m20", "m22", "m24",
  "pc", "jg", "un", "cx", "par",
]);

const MONTADORAS = [
  "RANDON", "VOLVO", "MERCEDES", "SCANIA", "IVECO", "MAN", "FORD",
  "VW", "VOLKSWAGEN", "CHEVROLET", "FIAT", "HYUNDAI", "TOYOTA",
  "HONDA", "YAMAHA", "SSANGYONG", "RENAULT", "PEUGEOT", "CITROEN",
];

function temDigitos(codigo: string): boolean {
  return /\d/.test(codigo);
}

/** Código com cara de peça comercial (não apenas palavra ou medida rosca). */
export function codigoConfiavel(codigo: string | null | undefined): boolean {
  if (!codigo) return false;
  const limpo = codigo.trim();
  if (limpo.length < 2) return false;

  const lower = limpo.toLowerCase();
  if (CODIGOS_SUSPEITOS.has(lower)) return false;

  // Medida rosca pura: M16, M16x1.5
  if (/^m\d+([x×]\d+[,.]?\d*)?$/i.test(limpo)) return false;

  // Código numérico longo ou alfanumérico com dígitos
  if (temDigitos(limpo) && limpo.length >= 3) return true;

  // Código alfanumérico curto sem dígitos é suspeito
  if (!temDigitos(limpo)) return false;

  return limpo.length >= 4;
}

function extrairMedidas(texto: string): string[] {
  const encontradas: string[] = [];
  const padroes = [
    /Ø\s*\d+(?:[,.]\d+)?/gi,
    /\bM\d+(?:\s*[xX×]\s*\d+(?:[,.]\d+)?)?/gi,
    /\b\d+(?:[,.]\d+)?\s*[xX×]\s*(?:Ø\s*)?\d+(?:[,.]\d+)?/gi,
  ];
  for (const re of padroes) {
    for (const m of texto.matchAll(re)) {
      const v = m[0].replace(/\s+/g, " ").trim();
      if (v) encontradas.push(v);
    }
  }
  return [...new Set(encontradas.map((m) => m.toUpperCase()))];
}

function extrairAplicacao(texto: string): string | null {
  const partes: string[] = [];

  const modAte = texto.match(/\bMOD\s+ATE\s+(\d{4})\b/i);
  if (modAte) partes.push(`Mod. até ${modAte[1]}`);

  for (const m of MONTADORAS) {
    const re = new RegExp(`\\b${m}\\b`, "i");
    if (re.test(texto) && !partes.some((p) => p.toUpperCase().includes(m))) {
      partes.push(m.charAt(0) + m.slice(1).toLowerCase());
    }
  }

  // Trecho após montadora conhecida no início (ex.: RANDON BAL TR CAVALO)
  const montadoraInicio = texto.match(
    new RegExp(`^(${MONTADORAS.join("|")})\\s+(.{5,60})`, "i")
  );
  if (montadoraInicio) {
    const trecho = montadoraInicio[2]
      .replace(/\bCOD:?\s*\d+/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (trecho.length >= 5 && trecho.length <= 80) {
      partes.push(trecho);
    }
  }

  if (partes.length === 0) return null;
  return [...new Set(partes)].join(" · ").slice(0, 255);
}

function escolherCodigoPrincipal(
  codigoInterno: string | null | undefined,
  numeroProduto: string | null | undefined,
  codigosExtraidos: string[]
): { principal: string; confianca: "alta" | "media" | "baixa"; corrigir: boolean } {
  const interno = (codigoInterno ?? "").trim();
  const numero = (numeroProduto ?? "").trim();

  const candidatosNumericos = codigosExtraidos.filter((c) => /^\d{3,}$/.test(c));
  const internoConfiavel = codigoConfiavel(interno);
  const numeroConfiavel = codigoConfiavel(numero);

  if (internoConfiavel) {
    return { principal: interno, confianca: "alta", corrigir: false };
  }

  if (candidatosNumericos.length === 1) {
    return {
      principal: candidatosNumericos[0],
      confianca: "alta",
      corrigir: interno.length > 0 && interno !== candidatosNumericos[0],
    };
  }

  if (candidatosNumericos.length > 1) {
    return {
      principal: candidatosNumericos[0],
      confianca: "media",
      corrigir: false,
    };
  }

  if (numeroConfiavel) {
    return {
      principal: numero,
      confianca: interno ? "media" : "alta",
      corrigir: !internoConfiavel && interno !== numero,
    };
  }

  if (codigosExtraidos.length === 1) {
    return {
      principal: codigosExtraidos[0],
      confianca: "media",
      corrigir: false,
    };
  }

  if (interno) {
    return { principal: interno, confianca: "baixa", corrigir: false };
  }

  if (numero) {
    return { principal: numero, confianca: "baixa", corrigir: false };
  }

  return { principal: "", confianca: "baixa", corrigir: false };
}

function definirStatus(
  titulo: string,
  codigoPrincipal: string,
  codigosExtraidos: string[],
  confianca: "alta" | "media" | "baixa"
): NormalizacaoStatus {
  if (!titulo || titulo === "Peça sem descrição") return "revisar";
  if (!codigoPrincipal) return "revisar";
  if (confianca === "baixa") return "revisar";
  if (confianca === "alta") return "ok";

  const numericosLongos = codigosExtraidos.filter((c) => /^\d{3,}$/.test(c));
  if (numericosLongos.length > 1) return "parcial";
  if (codigosExtraidos.length > 1) return "parcial";
  return "parcial";
}

export type ProdutoEntrada = {
  descricao: string | null;
  codigo_produto_interno: string;
  numero_produto?: string | null;
};

/**
 * Normaliza um produto a partir dos campos atuais do banco.
 * Idempotente: `descricao_original` vem sempre da descrição bruta atual.
 */
export function normalizarProduto(produto: ProdutoEntrada): ProdutoNormalizado {
  const descricaoBruta = (produto.descricao ?? "").replace(/\s+/g, " ").trim();
  const parsed = parseDescricao(descricaoBruta);

  const medidas = extrairMedidas(descricaoBruta);
  const aplicacao = extrairAplicacao(descricaoBruta);

  const { principal, confianca, corrigir } = escolherCodigoPrincipal(
    produto.codigo_produto_interno,
    produto.numero_produto,
    parsed.codigos
  );

  const titulo =
    parsed.titulo !== "Peça sem descrição"
      ? parsed.titulo
      : principal || produto.codigo_produto_interno || "Peça sem descrição";

  const status = definirStatus(titulo, principal, parsed.codigos, confianca);

  const deveCorrigirInterno = corrigir && confianca === "alta" && principal.length > 0;

  return {
    descricao_original: descricaoBruta || produto.descricao || "",
    titulo_normalizado: titulo,
    codigo_principal: principal,
    codigos_extraidos: parsed.codigos,
    medidas_extraidas: medidas,
    aplicacao_resumo: aplicacao,
    normalizacao_status: status,
    corrigir_codigo_interno: deveCorrigirInterno,
    codigo_produto_interno_anterior: deveCorrigirInterno ? produto.codigo_produto_interno : null,
    codigo_produto_interno_novo: deveCorrigirInterno ? principal : null,
  };
}
