// Template MVP 1.0 (sem preço) — Telas_MVP.md § 14

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

export function buildWhatsAppUrl(message: string, phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return `https://wa.me/?text=${encodeURIComponent(message)}`;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
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
