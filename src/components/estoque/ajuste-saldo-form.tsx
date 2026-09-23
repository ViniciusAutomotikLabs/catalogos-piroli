"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ajustarSaldoManual } from "@/lib/actions/estoque";

export function AjusteSaldoForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      setErro(null);
      const r = await ajustarSaldoManual(fd);
      if (!r.ok) {
        setErro(r.erro ?? "Falha no ajuste.");
        return;
      }
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary text-label-sm uppercase"
      >
        <span className="material-symbols-outlined text-[18px]">tune</span>
        Ajuste manual
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3 max-w-xl"
    >
      <h2 className="text-headline-sm font-semibold text-on-surface">Ajuste de saldo</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-label-sm text-on-surface-variant">Código</span>
          <input name="codigo" required className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md" />
        </label>
        <label className="block space-y-1">
          <span className="text-label-sm text-on-surface-variant">Quantidade</span>
          <input name="quantidade" type="number" step="0.001" required className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md" />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-label-sm text-on-surface-variant">Descrição</span>
          <input name="descricao" className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md" />
        </label>
        <label className="block space-y-1">
          <span className="text-label-sm text-on-surface-variant">Preço</span>
          <input name="preco" type="number" step="0.01" defaultValue={0} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md" />
        </label>
      </div>
      {erro && <p className="text-body-md text-error">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase disabled:opacity-60">
          Salvar
        </button>
        <button type="button" onClick={() => setAberto(false)} className="px-4 py-2 rounded-lg border border-outline-variant text-label-sm uppercase">
          Cancelar
        </button>
      </div>
    </form>
  );
}
