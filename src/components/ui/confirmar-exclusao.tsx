"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  aberto: boolean;
  titulo?: string;
  descricao?: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  pendente?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
};

/**
 * Modal de confirmação para ações destrutivas.
 * Nenhum delete de UI deve disparar sem passar por aqui.
 */
export function ConfirmarExclusao({
  aberto,
  titulo = "Excluir registro?",
  descricao = "Tem certeza que deseja apagar aqui mesmo? Esta ação não pode ser desfeita.",
  confirmarLabel = "Apagar",
  cancelarLabel = "Cancelar",
  pendente = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const tituloId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pendente) onCancelar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, pendente, onCancelar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-on-surface/40"
        onClick={() => !pendente && onCancelar()}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descId}
        className="relative w-full max-w-md rounded-xl bg-surface-container-lowest border border-outline-variant shadow-xl p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-[28px] shrink-0">warning</span>
          <div className="min-w-0 space-y-1">
            <h2 id={tituloId} className="text-headline-sm text-on-surface font-semibold">
              {titulo}
            </h2>
            <p id={descId} className="text-body-md text-on-surface-variant">
              {descricao}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={pendente}
            onClick={onCancelar}
            className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-label-sm uppercase hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {cancelarLabel}
          </button>
          <button
            type="button"
            disabled={pendente}
            onClick={onConfirmar}
            className="px-4 py-2 rounded-lg bg-error text-on-error text-label-sm uppercase hover:opacity-90 disabled:opacity-60"
          >
            {pendente ? "Apagando…" : confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
