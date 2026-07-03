// Template MVP 1.0 (sem preço) — Telas_MVP.md § 14

/**
 * Número de WhatsApp padrão da plataforma, usado quando a loja ainda não
 * cadastrou o próprio telefone (ex.: card de suporte no dashboard).
 * Formato E.164 sem "+": DDI 55 + DDD + número.
 */
export const WHATSAPP_PADRAO = "5561998117002";

export type ProdutoMensagem = {
  descricao: string | null;
  codigo: string;
  numeroProduto?: string | null;
  fabricante?: string | null;
  catalogo?: string | null;
  fotoUrl?: string | null;
};

export function buildProdutoMensagem(p: ProdutoMensagem, incluirFoto = true) {
  const linhas = [
    `🔧 *${p.descricao ?? "Peça"}*`,
    `Código: *${p.codigo}*`,
  ];
  if (p.numeroProduto || p.fabricante) {
    linhas.push(`Ref.: ${[p.numeroProduto, p.fabricante].filter(Boolean).join(" · ")}`);
  }
  if (p.catalogo) linhas.push(`Catálogo: ${p.catalogo}`);
  if (incluirFoto && p.fotoUrl) linhas.push("", p.fotoUrl);
  return linhas.join("\n");
}

/** Normaliza um telefone para o formato aceito pelo wa.me (DDI 55 + dígitos). */
export function normalizarTelefoneWhatsApp(phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function buildWhatsAppUrl(message: string, phone?: string | null) {
  const full = normalizarTelefoneWhatsApp(phone);
  if (!full) return `https://wa.me/?text=${encodeURIComponent(message)}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

/** Link direto para conversar com uma loja (ou com o número padrão da plataforma). */
export function buildContatoLojaUrl(phone?: string | null, message?: string) {
  const full = normalizarTelefoneWhatsApp(phone) || WHATSAPP_PADRAO;
  const base = `https://wa.me/${full}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export type OrcamentoMensagemItem = {
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
};

export function buildOrcamentoMensagem(
  itens: OrcamentoMensagemItem[],
  opts?: { clienteNome?: string | null; validadeDias?: number }
) {
  const validade = opts?.validadeDias ?? 5;
  const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0);
  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const linhas = [
    `📋 *Orçamento — válido por ${validade} dias*`,
    opts?.clienteNome ? `Cliente: ${opts.clienteNome}` : null,
    "",
    ...itens.map(
      (i) =>
        `• ${i.quantidade}x *${i.descricao}* (${i.codigo})${
          i.precoUnitario > 0 ? ` — ${formatBRL(i.quantidade * i.precoUnitario)}` : ""
        }`
    ),
    "",
    subtotal > 0 ? `💰 *Total: ${formatBRL(subtotal)}*` : null,
  ].filter((l): l is string => l !== null);

  return linhas.join("\n");
}

export function buildOrcamentoCodigos(itens: { codigo: string; quantidade: number }[]) {
  return itens.map((i) => (i.quantidade > 1 ? `${i.codigo} (${i.quantidade}x)` : i.codigo)).join("\n");
}
