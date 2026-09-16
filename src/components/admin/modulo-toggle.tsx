"use client";

import { useTransition } from "react";
import { alternarModulo } from "@/lib/actions/admin";

type Props = {
  lojaId: number;
  moduloChave: string;
  moduloNome: string;
  ativo: boolean;
  /** Módulo desligado globalmente (kill switch): entitlement não tem efeito. */
  globalOff?: boolean;
};

export function ModuloToggle({ lojaId, moduloChave, moduloNome, ativo, globalOff }: Props) {
  const [pendente, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await alternarModulo(lojaId, moduloChave, !ativo);
    });
  }

  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm border transition-colors disabled:opacity-50";
  const on = "bg-primary-fixed/40 border-primary text-primary";
  const off = "bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pendente}
      title={
        globalOff
          ? `${moduloNome}: desligado globalmente (kill switch)`
          : ativo
            ? `${moduloNome}: ativo — clique para desativar`
            : `${moduloNome}: inativo — clique para ativar`
      }
      className={`${base} ${ativo ? on : off}`}
    >
      <span className="material-symbols-outlined text-[16px]">
        {pendente ? "progress_activity" : ativo ? "check_circle" : "radio_button_unchecked"}
      </span>
      {moduloNome}
      {globalOff && <span className="material-symbols-outlined text-[14px] text-error">block</span>}
    </button>
  );
}
