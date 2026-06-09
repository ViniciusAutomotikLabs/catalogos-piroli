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
      onClick={handleClick}
      className="w-8 h-8 rounded bg-surface-container hover:bg-secondary hover:text-on-primary text-secondary transition-colors flex items-center justify-center border border-transparent hover:border-secondary"
      title="Compartilhar WhatsApp"
    >
      <WhatsAppIcon />
    </button>
  );
}
