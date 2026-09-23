"use client";

import { useRouter } from "next/navigation";
import { removerConsulta } from "@/lib/actions/historico";
import { BotaoExcluirConfirmado } from "@/components/ui/botao-excluir-confirmado";

export function BotaoRemoverConsulta({ id }: { id: number }) {
  const router = useRouter();

  return (
    <BotaoExcluirConfirmado
      titulo="Excluir consulta?"
      descricao="Tem certeza que deseja apagar este registro do histórico?"
      ariaLabel="Excluir consulta"
      className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors"
      onConfirmar={async () => {
        await removerConsulta(id);
        router.refresh();
      }}
    />
  );
}
