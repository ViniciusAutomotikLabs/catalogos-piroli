"use client";

import { useState, useTransition } from "react";
import { definirSyncLegadoAtivo } from "@/lib/actions/sync-legado";
import { ConfirmarExclusao } from "@/components/ui/confirmar-exclusao";

export function ToggleSyncLegado({ ativoInicial }: { ativoInicial: boolean }) {
  const [ativo, setAtivo] = useState(ativoInicial);
  const [confirmar, setConfirmar] = useState<"ligar" | "desligar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function executar() {
    if (!confirmar) return;
    const novo = confirmar === "ligar";
    startTransition(async () => {
      setErro(null);
      const r = await definirSyncLegadoAtivo(novo);
      if (!r.ok) {
        setErro(r.erro ?? "Falha ao atualizar.");
        setConfirmar(null);
        return;
      }
      setAtivo(novo);
      setConfirmar(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-body-md font-semibold text-on-surface">
            Sincronização SS Plus / GPASI
          </p>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            {ativo
              ? "Ativa: jobs atualizam o espelho de estoque a partir do legado."
              : "Desligada: o ERP opera só com saldos e movimentos locais (sem SS Plus)."}
          </p>
        </div>
        <span
          className={`inline-flex px-2.5 py-1 rounded-lg text-label-sm uppercase border ${
            ativo
              ? "border-primary/40 bg-primary-container/30 text-primary"
              : "border-outline-variant text-on-surface-variant"
          }`}
        >
          {ativo ? "Sync ligada" : "Sync desligada"}
        </span>
      </div>

      {ativo ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmar("desligar")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-error/40 text-error hover:bg-error hover:text-on-error transition-colors text-label-sm uppercase disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">sync_disabled</span>
          Parar sincronização SS Plus
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmar("ligar")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary hover:opacity-90 transition-colors text-label-sm uppercase disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">sync</span>
          Religar sincronização SS Plus
        </button>
      )}

      {erro && (
        <p className="text-body-md text-error bg-error-container/40 border border-error/30 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

      <ConfirmarExclusao
        aberto={confirmar !== null}
        titulo={
          confirmar === "desligar"
            ? "Parar sincronização SS Plus?"
            : "Religar sincronização SS Plus?"
        }
        descricao={
          confirmar === "desligar"
            ? "Os jobs GPASI deixarão de atualizar o espelho. O balcão continua operando só com estoque local. Tem certeza?"
            : "Os jobs voltarão a ler o SS Plus/GPASI e atualizar o espelho. Tem certeza?"
        }
        confirmarLabel={confirmar === "desligar" ? "Parar sync" : "Religar"}
        pendente={pending}
        onCancelar={() => !pending && setConfirmar(null)}
        onConfirmar={executar}
      />
    </div>
  );
}
