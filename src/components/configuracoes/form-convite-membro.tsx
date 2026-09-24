"use client";

import { useActionState } from "react";
import { convidarMembro, type EstadoConvite } from "@/lib/actions/membros";
import { PAPEIS_MEMBRO, labelPapel } from "@/lib/membros";

const initial: EstadoConvite = null;

export function FormConviteMembro() {
  const [state, action, pending] = useActionState(convidarMembro, initial);

  return (
    <form action={action} className="mt-4 space-y-3 rounded-lg border border-outline-variant bg-surface-container-low/60 p-4">
      <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">
        Convidar funcionário
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 flex flex-col gap-1.5">
          <label htmlFor="convite-email" className="text-label-sm text-on-surface-variant">
            E-mail
          </label>
          <input
            id="convite-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="funcionario@loja.com.br"
            className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="sm:w-44 flex flex-col gap-1.5">
          <label htmlFor="convite-papel" className="text-label-sm text-on-surface-variant">
            Papel
          </label>
          <select
            id="convite-papel"
            name="papel"
            defaultValue="vendedor"
            className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {PAPEIS_MEMBRO.map((p) => (
              <option key={p} value={p}>
                {labelPapel(p)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-label-sm uppercase text-on-primary transition-colors hover:bg-primary-container disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {pending ? "Enviando…" : "Convidar"}
        </button>
      </div>
      {state?.erro ? (
        <p className="text-body-md text-error bg-error-container/40 border border-error/30 rounded-lg px-3 py-2">
          {state.erro}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-body-md text-secondary bg-secondary-container/50 border border-secondary/30 rounded-lg px-3 py-2">
          {state.aviso ?? "Convite enviado. O funcionário receberá um e-mail para definir a senha."}
        </p>
      ) : null}
    </form>
  );
}
