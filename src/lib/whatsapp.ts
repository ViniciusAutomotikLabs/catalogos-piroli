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
