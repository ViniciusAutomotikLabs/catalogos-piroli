"use client";

import { useTransition } from "react";
import { alterarStatusFerias, removerFerias } from "@/lib/actions/rh-ferias";

export function AcoesFerias({ id, status }: { id: number; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1 justify-end">
      {status !== "gozada" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => void alterarStatusFerias(id, "gozada"))}
          className="text-label-sm px-2 py-1 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary disabled:opacity-60"
          title="Marcar como gozada"
        >
          Gozada
        </button>
      )}
      {status !== "paga" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => void alterarStatusFerias(id, "paga"))}
          className="text-label-sm px-2 py-1 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary disabled:opacity-60"
          title="Marcar como paga"
        >
          Paga
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => void removerFerias(id))}
        className="text-error hover:bg-error-container/40 rounded p-1 disabled:opacity-60"
        aria-label="Remover férias"
      >
        <span className="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </div>
  );
}
