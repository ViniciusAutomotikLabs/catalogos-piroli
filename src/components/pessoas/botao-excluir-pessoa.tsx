"use client";

import { useState, useTransition } from "react";
import { excluirPessoa } from "@/lib/actions/pessoas";
import { ConfirmarExclusao } from "@/components/ui/confirmar-exclusao";

export function BotaoExcluirPessoa({
  pessoaId,
  nome,
}: {
  pessoaId: number;
  nome: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-error/40 text-error hover:bg-error-container/40 transition-colors text-label-sm uppercase"
      >
        <span className="material-symbols-outlined text-[18px]">delete</span>
        Excluir
      </button>
      <ConfirmarExclusao
        aberto={aberto}
        titulo="Excluir pessoa?"
        descricao={`Tem certeza que deseja apagar “${nome}” aqui mesmo? Esta ação não pode ser desfeita.`}
        pendente={pendente}
        onCancelar={() => setAberto(false)}
        onConfirmar={() => {
          startTransition(async () => {
            await excluirPessoa(pessoaId);
          });
        }}
      />
    </>
  );
}
