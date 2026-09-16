"use client";

import { useActionState, useTransition } from "react";
import {
  abrirCompetencia,
  gerarItensCompetencia,
  fecharCompetencia,
  reabrirCompetencia,
  type EstadoRH,
} from "@/lib/actions/rh-folha";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const INPUT =
  "px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary outline-none";

export function AbrirCompetencia({ anoAtual, mesAtual }: { anoAtual: number; mesAtual: number }) {
  const [estado, action, pend] = useActionState<EstadoRH, FormData>(abrirCompetencia, null);
  return (
    <form action={action} className="flex items-end gap-3 flex-wrap">
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm text-on-surface-variant">Mês</label>
        <select name="mes" defaultValue={mesAtual} className={INPUT}>
          {MESES.map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm text-on-surface-variant">Ano</label>
        <input type="number" name="ano" defaultValue={anoAtual} className={`${INPUT} w-28`} />
      </div>
      <button
        type="submit"
        disabled={pend}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        {pend ? "Abrindo…" : "Abrir competência"}
      </button>
      {estado?.erro && <span className="text-label-sm text-error self-center">{estado.erro}</span>}
      {estado?.ok && <span className="text-label-sm text-primary self-center">{estado.mensagem}</span>}
    </form>
  );
}

export function AcoesCompetencia({
  competenciaId,
  status,
}: {
  competenciaId: number;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const fechada = status === "fechada";

  return (
    <div className="flex items-center gap-2">
      {!fechada && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => void gerarItensCompetencia(competenciaId))}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-primary hover:border-primary text-label-sm uppercase disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">group_add</span>
          Gerar itens
        </button>
      )}
      {fechada ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => void reabrirCompetencia(competenciaId))}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary text-label-sm uppercase disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">lock_open</span>
          Reabrir
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => void fecharCompetencia(competenciaId))}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">lock</span>
          Fechar competência
        </button>
      )}
    </div>
  );
}
