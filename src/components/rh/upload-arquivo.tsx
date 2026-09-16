"use client";

import { useRef, useState } from "react";
import { uploadArquivoRh } from "@/lib/actions/rh-storage";

type Props = {
  organizacaoId: number;
  /** Nome do input hidden que carrega o path salvo. */
  name?: string;
  /** Subpasta lógica dentro da organização (ex.: "documentos", "atestados"). */
  pasta?: string;
  valorInicial?: string | null;
};

const TAMANHO_MAX_MB = 10;

/**
 * Upload de arquivo (PDF/imagem) para o bucket privado `rh` via server action
 * (service_role). Grava o PATH num input hidden.
 */
export function UploadArquivo({
  name = "arquivo_url",
  pasta = "documentos",
  valorInicial = null,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(valorInicial);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > TAMANHO_MAX_MB * 1024 * 1024) {
      setErro(`Arquivo muito grande. Máximo ${TAMANHO_MAX_MB} MB.`);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.set("arquivo", f);
      fd.set("pasta", pasta);
      const resultado = await uploadArquivoRh(fd);
      if (resultado.erro || !resultado.path) {
        setErro(resultado.erro ?? "Falha no upload.");
        return;
      }
      setPath(resultado.path);
      setNomeArquivo(f.name);
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remover() {
    setPath(null);
    setNomeArquivo(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name={name} value={path ?? ""} readOnly />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={enviando}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors text-label-sm uppercase disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">
            {enviando ? "progress_activity" : "upload_file"}
          </span>
          {enviando ? "Enviando…" : path ? "Trocar arquivo" : "Enviar arquivo"}
        </button>
        {path && (
          <>
            <span className="text-label-sm text-on-surface-variant truncate max-w-[180px]">
              {nomeArquivo ?? "arquivo anexado"}
            </span>
            <button
              type="button"
              onClick={remover}
              className="text-error hover:bg-error-container/40 rounded p-1"
              aria-label="Remover arquivo"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={onArquivo}
      />
      {erro && <p className="text-label-sm text-error">{erro}</p>}
    </div>
  );
}
