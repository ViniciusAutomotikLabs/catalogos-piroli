"use client";

import { useState } from "react";
import { urlAssinadaRh } from "@/lib/actions/rh-storage";

type Props = {
  path: string | null | undefined;
  children: React.ReactNode;
  className?: string;
};

/**
 * Abre um arquivo do bucket privado `rh` via signed URL gerada no servidor.
 */
export function LinkArquivoRh({ path, children, className }: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  if (!path) return <span className={className}>{children}</span>;
  const storagePath = path;

  async function abrir(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setErro(null);
    setAbrindo(true);
    try {
      const resultado = await urlAssinadaRh(storagePath);
      if (resultado.erro || !resultado.url) {
        setErro(resultado.erro ?? "Não foi possível abrir o arquivo.");
        return;
      }
      window.open(resultado.url, "_blank", "noopener,noreferrer");
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={abrir}
        disabled={abrindo}
        className={
          className ??
          "text-primary hover:underline inline-flex items-center gap-1 text-body-md capitalize disabled:opacity-60"
        }
        title="Abrir arquivo"
      >
        {children}
        <span className="material-symbols-outlined text-[16px]">
          {abrindo ? "progress_activity" : "open_in_new"}
        </span>
      </button>
      {erro && <span className="text-label-sm text-error">{erro}</span>}
    </span>
  );
}
