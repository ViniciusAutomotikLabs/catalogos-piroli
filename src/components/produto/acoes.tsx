"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { addToCart, cartCount } from "@/lib/cart";
import {
  buildProdutoMensagem,
  buildWhatsAppUrl,
  type ProdutoMensagem,
} from "@/lib/whatsapp";
import { useFocusTrap } from "@/lib/use-focus-trap";

type Props = {
  produto: ProdutoMensagem & { produtoId: number | null };
  telefoneLoja?: string | null;
};

export function ProdutoAcoes({ produto, telefoneLoja }: Props) {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);
  const [incluirFoto, setIncluirFoto] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const modalRef = useFocusTrap<HTMLDivElement>(modalAberto, () => setModalAberto(false));

  const mensagem = buildProdutoMensagem(produto, incluirFoto);

  function avisar(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  }

  function abrirModal() {
    setTexto(buildProdutoMensagem(produto, incluirFoto));
    setModalAberto(true);
  }

  function alternarFoto(v: boolean) {
    setIncluirFoto(v);
    setTexto(buildProdutoMensagem(produto, v));
  }

  async function copiar(txt: string, msg: string) {
    await navigator.clipboard.writeText(txt);
    avisar(msg);
  }

  return (
    <>
      {/* Barra de ações fixa */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant px-4 md:px-8 py-3 z-40 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {feedback && (
              <span className="text-body-md text-secondary font-semibold">{feedback}</span>
            )}
            <button
              onClick={() => copiar(produto.codigo, "Código copiado!")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary text-on-tertiary hover:bg-tertiary-container transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              Copiar código
            </button>
            <button
              onClick={() => copiar(mensagem, "Texto copiado!")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface hover:border-primary hover:text-primary transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              Copiar texto
            </button>
            <button
              onClick={() => {
                addToCart({
                  produtoId: produto.produtoId,
                  codigo: produto.codigo,
                  descricao: produto.descricao ?? "Peça",
                  fabricante: produto.fabricante,
                  fotoUrl: produto.fotoUrl,
                  precoUnitario: 0,
                });
                avisar(`Adicionado! ${cartCount()} item(ns) — abra Orçamento no menu`);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary text-primary hover:bg-primary hover:text-on-primary transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
              Orçamento
            </button>
            <button
              onClick={abrirModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary text-on-secondary font-semibold shadow-sm hover:opacity-90 transition-opacity text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Enviar WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* Modal WhatsApp (W10) */}
      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalAberto(false)}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl w-full max-w-[520px] flex flex-col focus:outline-none"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="produto-modal-titulo"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h2 id="produto-modal-titulo" className="text-headline-sm text-on-surface font-semibold flex items-center gap-2">
                <WhatsAppIcon className="w-5 h-5 text-secondary" />
                Compartilhar no WhatsApp
              </h2>
              <button
                onClick={() => setModalAberto(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Fechar modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="produto-mensagem"
                  className="text-label-sm text-on-surface-variant"
                >
                  Revise a mensagem antes de enviar
                </label>
                <textarea
                  id="produto-mensagem"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={8}
                  className="bg-surface-container-low border border-outline-variant rounded-lg p-4 text-body-md text-on-surface whitespace-pre-wrap font-sans resize-y focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>
              <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirFoto}
                  onChange={(e) => alternarFoto(e.target.checked)}
                  className="rounded border-outline-variant text-primary focus:ring-primary"
                />
                Incluir link da foto
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant">
              <button
                onClick={() => copiar(texto, "Texto copiado!")}
                className="px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface hover:border-primary hover:text-primary transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Copiar texto
              </button>
              <a
                href={buildWhatsAppUrl(texto, telefoneLoja)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary text-on-secondary font-semibold shadow-sm hover:opacity-90 transition-opacity text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Enviar WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
