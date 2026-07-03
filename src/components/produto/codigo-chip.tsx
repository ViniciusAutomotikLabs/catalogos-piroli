"use client";

import { useState } from "react";

type Props = {
  label: string;
  value: string;
};

/**
 * Chip de código copiável — clique copia o valor para a área de transferência.
 * Segue o mesmo padrão de copy-to-clipboard de `ProdutoAcoes`.
 */
export function CodigoChip({ label, value }: Props) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* área de transferência indisponível — ignora silenciosamente */
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${label}: ${value}`}
      title="Copiar"
      className="group inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-left hover:border-primary hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex flex-col min-w-0">
        <span className="text-[11px] tracking-wide text-on-surface-variant leading-4">
          {label}
        </span>
        <span className="font-mono text-code-md text-primary truncate">{value}</span>
      </span>
      <span
        className={`material-symbols-outlined text-[18px] shrink-0 ${
          copiado ? "text-secondary" : "text-on-surface-variant group-hover:text-primary"
        }`}
      >
        {copiado ? "check" : "content_copy"}
      </span>
    </button>
  );
}
