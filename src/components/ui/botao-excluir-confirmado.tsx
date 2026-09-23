"use client";

import { useState, useTransition } from "react";
import { ConfirmarExclusao } from "@/components/ui/confirmar-exclusao";

type Props = {
  onConfirmar: () => void | Promise<unknown>;
  titulo?: string;
  descricao?: string;
  ariaLabel?: string;
  className?: string;
  children?: React.ReactNode;
};

/** Botão de excluir que abre o modal de confirmação antes de executar. */
export function BotaoExcluirConfirmado({
  onConfirmar,
  titulo,
  descricao,
  ariaLabel = "Excluir",
  className = "text-error hover:bg-error-container/40 rounded p-1 disabled:opacity-60",
  children,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={pendente}
        onClick={() => setAberto(true)}
        className={className}
        aria-label={ariaLabel}
      >
        {children ?? <span className="material-symbols-outlined text-[18px]">delete</span>}
      </button>
      <ConfirmarExclusao
        aberto={aberto}
        titulo={titulo}
        descricao={descricao}
        pendente={pendente}
        onCancelar={() => setAberto(false)}
        onConfirmar={() => {
          startTransition(async () => {
            await onConfirmar();
            setAberto(false);
          });
        }}
      />
    </>
  );
}
