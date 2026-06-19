"use client";

import Link from "next/link";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import {
  buildOrcamentoCodigos,
  buildOrcamentoMensagem,
  buildWhatsAppUrl,
} from "@/lib/whatsapp";
import type { CartItem } from "@/lib/cart";

type Props = {
  itens: CartItem[];
  clienteNome?: string | null;
  telefoneDestino?: string | null;
};

export function OrcamentoBarraAcoes({ itens, clienteNome, telefoneDestino }: Props) {
  const [modalAberto, setModalAberto] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const temItens = itens.length > 0;
  const mensagem = buildOrcamentoMensagem(itens, { clienteNome, validadeDias: 5 });
  const codigos = buildOrcamentoCodigos(itens);

  function avisar(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  }

  async function copiar(texto: string, msg: string) {
    await navigator.clipboard.writeText(texto);
    avisar(msg);
  }

  return (
    <>
      <div className="fixed bottom-0 left-64 right-0 bg-surface-container-lowest border-t border-outline-variant px-8 py-3 z-40 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3">
          <Link
            href="/busca"
            className="flex items-center gap-2 px-4 py-2.5 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            Buscar peças
          </Link>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {feedback && (
              <span className="text-body-md text-secondary font-semibold">{feedback}</span>
            )}
            <button
              type="button"
              disabled={!temItens}
              onClick={() => copiar(codigos, "Códigos copiados!")}
              className="flex items-center gap-2 px-4 py-2.5 rounded bg-tertiary text-on-tertiary hover:bg-tertiary-container transition-colors text-label-sm uppercase disabled:opacity-40 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              Copiar código
            </button>
            <button
              type="button"
              disabled={!temItens}
              onClick={() => copiar(mensagem, "Texto copiado!")}
              className="flex items-center gap-2 px-4 py-2.5 rounded border border-outline-variant text-on-surface hover:border-primary hover:text-primary transition-colors text-label-sm uppercase disabled:opacity-40 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              Copiar texto
            </button>
            <Link
              href="/busca"
              className="flex items-center gap-2 px-4 py-2.5 rounded border border-primary text-primary hover:bg-primary hover:text-on-primary transition-colors text-label-sm uppercase"
            >
              <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
              Orçamento
            </Link>
            <button
              type="button"
              disabled={!temItens}
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded bg-secondary text-on-secondary hover:bg-on-secondary-container transition-colors text-label-sm uppercase disabled:opacity-40 disabled:pointer-events-none"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Enviar WhatsApp
            </button>
          </div>
        </div>
      </div>

      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setModalAberto(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-xl w-full max-w-[520px] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h2 className="text-headline-sm text-primary flex items-center gap-2">
                <WhatsAppIcon className="w-5 h-5 text-secondary" />
                Enviar orçamento no WhatsApp
              </h2>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6">
              <pre className="bg-surface-container-low border border-outline-variant rounded p-4 text-body-md text-on-surface whitespace-pre-wrap font-sans">
                {mensagem}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => copiar(mensagem, "Texto copiado!")}
                className="px-4 py-2.5 rounded border border-outline-variant text-on-surface hover:border-primary hover:text-primary transition-colors text-label-sm uppercase"
              >
                Copiar texto
              </button>
              <a
                href={buildWhatsAppUrl(mensagem, telefoneDestino)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded bg-secondary text-on-secondary hover:bg-on-secondary-container transition-colors text-label-sm uppercase"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Abrir WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
