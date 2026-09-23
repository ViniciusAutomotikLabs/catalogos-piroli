"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import {
  cancelarVenda,
  confirmarEntrega,
  excluirVendaRascunho,
  fecharVenda,
} from "@/lib/actions/vendas";
import { BotaoExcluirConfirmado } from "@/components/ui/botao-excluir-confirmado";
import { ConfirmarExclusao } from "@/components/ui/confirmar-exclusao";

export function AcoesVenda({
  vendaId,
  status,
  entregaStatus,
}: {
  vendaId: number;
  status: string;
  entregaStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarFechar, setConfirmarFechar] = useState(false);
  const [confirmarEntregaModal, setConfirmarEntregaModal] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  function run(fn: () => Promise<{ ok?: boolean; erro?: string }>, fechar?: () => void) {
    startTransition(async () => {
      setErro(null);
      const r = await fn();
      fechar?.();
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "aberta" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmarFechar(true)}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase disabled:opacity-60"
          >
            Fechar venda
          </button>
        )}
        {(status === "aberta" || status === "fechada") &&
          entregaStatus !== "entregue" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmarEntregaModal(true)}
              className="px-4 py-2 rounded-lg border border-primary text-primary text-label-sm uppercase disabled:opacity-60"
            >
              Confirmar entrega
            </button>
          )}
        {(status === "aberta" || status === "fechada") &&
          entregaStatus === "pendente" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmarCancelar(true)}
              className="px-4 py-2 rounded-lg border border-error/40 text-error text-label-sm uppercase disabled:opacity-60"
            >
              Cancelar
            </button>
          )}
        {status !== "cancelada" &&
          status !== "rascunho" &&
          entregaStatus !== "pendente" && (
            <p className="text-label-sm text-on-surface-variant self-center">
              Cancelamento bloqueado após entrega
            </p>
          )}
        {status === "rascunho" && (
          <BotaoExcluirConfirmado
            titulo="Excluir venda?"
            descricao="Tem certeza que deseja apagar este rascunho de venda?"
            className="px-4 py-2 rounded-lg border border-error/40 text-error text-label-sm uppercase inline-flex items-center gap-1"
            onConfirmar={async () => {
              const r = await excluirVendaRascunho(vendaId);
              if (r.erro) setErro(r.erro);
              else router.push("/vendas");
            }}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Excluir
          </BotaoExcluirConfirmado>
        )}
      </div>
      {erro && (
        <p className="text-body-md text-error bg-error-container/40 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

      <ConfirmarExclusao
        aberto={confirmarFechar}
        titulo="Fechar venda?"
        descricao="Gera título a receber e mantém a reserva até a entrega. Continuar?"
        confirmarLabel="Fechar"
        pendente={pending}
        onCancelar={() => setConfirmarFechar(false)}
        onConfirmar={() => run(() => fecharVenda(vendaId), () => setConfirmarFechar(false))}
      />
      <ConfirmarExclusao
        aberto={confirmarEntregaModal}
        titulo="Confirmar entrega?"
        descricao="Baixa definitiva no espelho de estoque. Tem certeza?"
        confirmarLabel="Entregar"
        pendente={pending}
        onCancelar={() => setConfirmarEntregaModal(false)}
        onConfirmar={() =>
          run(() => confirmarEntrega(vendaId), () => setConfirmarEntregaModal(false))
        }
      />
      <ConfirmarExclusao
        aberto={confirmarCancelar}
        titulo="Cancelar venda?"
        descricao="Libera reservas no espelho e cancela título em aberto. Tem certeza?"
        confirmarLabel="Cancelar venda"
        pendente={pending}
        onCancelar={() => setConfirmarCancelar(false)}
        onConfirmar={() =>
          run(() => cancelarVenda(vendaId), () => setConfirmarCancelar(false))
        }
      />
    </div>
  );
}
