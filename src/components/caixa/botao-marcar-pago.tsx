"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { marcarTituloPago } from "@/lib/actions/financeiro";

export function BotaoMarcarPago({ tituloId }: { tituloId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await marcarTituloPago(tituloId);
          router.refresh();
        });
      }}
      className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase disabled:opacity-60"
    >
      {pending ? "…" : "Marcar pago"}
    </button>
  );
}
