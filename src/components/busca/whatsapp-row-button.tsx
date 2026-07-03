"use client";

import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { buildProdutoMensagem, buildWhatsAppUrl, type ProdutoMensagem } from "@/lib/whatsapp";

export function WhatsAppRowButton({ produto }: { produto: ProdutoMensagem }) {
  function handleClick() {
    const msg = buildProdutoMensagem(produto);
    window.open(buildWhatsAppUrl(msg), "_blank", "noopener");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-8 h-8 rounded-lg bg-surface-container hover:bg-secondary hover:text-on-secondary text-secondary transition-colors flex items-center justify-center border border-transparent hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      title="Compartilhar WhatsApp"
      aria-label="Compartilhar no WhatsApp"
    >
      <WhatsAppIcon />
    </button>
  );
}
