"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmarEntrega } from "@/lib/actions/vendas";
import { ConfirmarExclusao } from "@/components/ui/confirmar-exclusao";

export function BotaoConfirmarEntregaFila({ vendaId }: { vendaId: number }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase"
      >
        Confirmar entrega
      </button>
      <ConfirmarExclusao
        aberto={aberto}
        titulo="Confirmar entrega?"
        descricao="Baixa definitiva no espelho. Tem certeza?"
        confirmarLabel="Entregar"
        pendente={pending}
        onCancelar={() => setAberto(false)}
        onConfirmar={() => {
          startTransition(async () => {
            await confirmarEntrega(vendaId);
            setAberto(false);
            router.refresh();
          });
        }}
      />
    </>
  );
}
