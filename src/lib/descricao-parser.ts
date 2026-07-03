/**
 * Limpeza de descrições brutas extraídas dos PDFs de catálogo.
 *
 * As descrições chegam com ruído herdado da extração: cabeçalhos de tabela
 * ("CÓDIGO DESCRIÇÃO"), numeração de lista ("2.", "240."), "leaders"
 * pontilhados de índice ("...... 104") e códigos embutidos ("COD: 537").
 *
 * Este módulo é puramente de apresentação: o texto original é sempre
 * preservado em `textoOriginal` para exibição integral (tooltip / detalhe).
 * Quando o backend passar a gravar campos estruturados, a UI pode migrar
 * para eles sem alterar os componentes que consomem `parseDescricao`.
 */

export type DescricaoParse = {
  /** Título limpo e escaneável (sem cabeçalho/numeração/leaders/códigos COD:). */
  titulo: string;
  /** Códigos extraídos do texto (tokens "COD:" e código principal vazado). */
  codigos: string[];
  /** Texto original, apenas com espaços normalizados nas pontas. */
  textoOriginal: string;
  /** Indica se a limpeza mudou algo relevante frente ao original. */
  alterado: boolean;
};

const FALLBACK_TITULO = "Peça sem descrição";

/** Remove "leaders" de índice: sequências de pontos seguidas de nº de página. */
function removerLeaders(texto: string): string {
  return texto.replace(/\.{3,}\s*\d*/g, " ");
}

/** Extrai códigos no formato "COD: 537" / "CÓD 641", removendo-os do texto. */
function extrairCodigosCod(texto: string, codigos: string[]): string {
  return texto.replace(/\bc[oó]d\.?\s*:?\s*([a-z0-9][a-z0-9./-]*)/gi, (_m, code: string) => {
    const limpo = code.trim();
    if (limpo) codigos.push(limpo);
    return " ";
  });
}

/**
 * Remove ruído de início de string, em laço (pode haver várias camadas):
 * cabeçalho de tabela, numeração de lista e prefixo pontilhado.
 */
function removerPrefixosRuido(texto: string): string {
  let s = texto;
  let mudou = true;
  while (mudou) {
    mudou = false;
    const anterior = s;

    // Cabeçalho de tabela vazado do PDF.
    s = s.replace(/^\s*(c[oó]digo|descri[cç][aã]o)\b[\s:.-]*/i, "");
    // Numeração de lista seguida de texto: "2.", "240.", "10)", "2.JUNTA".
    // Exige uma letra em seguida para não engolir medidas ("2.0", "1,5").
    s = s.replace(/^\s*\d{1,3}[.)]\s*(?=\p{L})/u, "");
    // Numeração com ponto inicial: ".010".
    s = s.replace(/^\s*\.\d{1,4}\s+/, "");

    if (s !== anterior) mudou = true;
  }
  return s;
}

/**
 * Após remover o cabeçalho, um código principal costuma ficar "solto" no
 * início (ex.: "1386677 CONECTOR FILTRO..."). Extrai apenas quando é um
 * número longo (>= 4 dígitos) seguido de texto — evita capturar numeração.
 */
function extrairCodigoPrincipalInicial(texto: string, codigos: string[]): string {
  return texto.replace(/^\s*(\d{4,})\s+(?=[\p{L}])/u, (_m, code: string) => {
    codigos.push(code);
    return "";
  });
}

function normalizarEspacos(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Remove duplicatas preservando a ordem de aparição. */
function unicos(itens: string[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const item of itens) {
    const chave = item.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(item);
  }
  return saida;
}

/**
 * Interpreta uma descrição bruta em título limpo + códigos, preservando o
 * texto original. Nunca lança; entrada nula/vazia retorna o fallback.
 */
export function parseDescricao(raw: string | null | undefined): DescricaoParse {
  const textoOriginal = (raw ?? "").replace(/\s+/g, " ").trim();

  if (!textoOriginal) {
    return { titulo: FALLBACK_TITULO, codigos: [], textoOriginal: "", alterado: false };
  }

  const codigos: string[] = [];
  let s = textoOriginal;
  s = removerLeaders(s);
  s = extrairCodigosCod(s, codigos);
  s = removerPrefixosRuido(s);
  s = extrairCodigoPrincipalInicial(s, codigos);
  s = normalizarEspacos(s);

  const titulo = s || unicos(codigos)[0] || FALLBACK_TITULO;
  const codigosUnicos = unicos(codigos);
  const alterado = titulo !== textoOriginal || codigosUnicos.length > 0;

  return { titulo, codigos: codigosUnicos, textoOriginal, alterado };
}

/** Atalho para quando só o título limpo é necessário. */
export function tituloDescricao(raw: string | null | undefined): string {
  return parseDescricao(raw).titulo;
}
