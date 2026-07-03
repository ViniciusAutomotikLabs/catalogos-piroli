"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

const EXTENSOES = [".csv", ".xlsx", ".xls", ".pdf"];
const TAMANHO_MAX_MB = 50;
const TAMANHO_MAX_BYTES = TAMANHO_MAX_MB * 1024 * 1024;

export function UploadCatalogoForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fabricante, setFabricante] = useState("");
  const [nome, setNome] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function aceitarArquivo(f: File | undefined) {
    if (!f) return;
    const ok = EXTENSOES.some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!ok) {
      setErro(`Formato não suportado. Use: ${EXTENSOES.join(", ")}`);
      return;
    }
    if (f.size > TAMANHO_MAX_BYTES) {
      setErro(`Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB). Máximo: ${TAMANHO_MAX_MB} MB.`);
      return;
    }
    setErro(null);
    setArquivo(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo || !nome) return;
    if (arquivo.size > TAMANHO_MAX_BYTES) {
      setErro(`Arquivo muito grande. Máximo: ${TAMANHO_MAX_MB} MB.`);
      return;
    }
    setEnviando(true);
    setErro(null);

    const supabase = createClient();
    const slug = slugify(`${fabricante} ${nome}`.trim() || arquivo.name);
    const path = `${slug}/${Date.now()}_${arquivo.name}`;

    const { error: upErr } = await supabase.storage
      .from("imports")
      .upload(path, arquivo, { upsert: false });
    if (upErr) {
      setErro(`Falha no upload: ${upErr.message}`);
      setEnviando(false);
      return;
    }

    const extensao = arquivo.name.toLowerCase().split(".").pop();
    const { error: insErr } = await supabase.from("catalogos").insert({
      slug,
      nome_exibicao: nome,
      tipo_fonte: extensao === "pdf" ? "pdf" : "planilha",
      arquivo_path: `imports/${path}`,
      status: "pendente",
    });
    if (insErr) {
      setErro(`Arquivo enviado, mas falhou ao registrar o catálogo: ${insErr.message}`);
      setEnviando(false);
      return;
    }

    setSucesso(true);
    setEnviando(false);
    setTimeout(() => router.push("/catalogos"), 1500);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <nav className="flex items-center gap-2 text-body-md text-on-surface-variant">
        <Link href="/catalogos" className="hover:text-primary hover:underline">
          Catálogos
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold">Upload de Base de Dados</span>
      </nav>

      <div>
        <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">Upload de base de dados</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Envie o catálogo do fabricante (CSV, Excel ou PDF). O processamento é feito pela fila
          de ingestão — o catálogo entra como <strong>pendente</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-label-sm text-on-surface-variant" htmlFor="fabricante">
                  Fabricante
                </label>
                <input
                  id="fabricante"
                  type="text"
                  value={fabricante}
                  onChange={(e) => setFabricante(e.target.value)}
                  placeholder="Ex.: NGK, Bosch, Fram"
                  className="px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-label-sm text-on-surface-variant" htmlFor="nome">
                  Nome do catálogo *
                </label>
                <input
                  id="nome"
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Tabela NGK 2026"
                  className="px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Drag and drop */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                aceitarArquivo(e.dataTransfer.files[0]);
              }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                arrastando
                  ? "border-primary bg-primary-fixed/20"
                  : "border-outline-variant hover:border-primary bg-surface-container-low"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={EXTENSOES.join(",")}
                className="hidden"
                onChange={(e) => aceitarArquivo(e.target.files?.[0])}
              />
              <span className="material-symbols-outlined text-primary text-5xl">
                cloud_upload
              </span>
              {arquivo ? (
                <div className="text-center">
                  <p className="text-body-lg font-semibold text-on-surface">{arquivo.name}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-body-lg text-on-surface">
                    Arraste o arquivo aqui ou <span className="text-primary underline">clique para selecionar</span>
                  </p>
                  <p className="text-label-sm text-on-surface-variant mt-1">
                    CSV, XLSX ou PDF · máx. {TAMANHO_MAX_MB} MB
                  </p>
                </div>
              )}
            </div>

            {erro && (
              <p className="text-body-md text-error bg-error-container/50 border border-error/30 rounded px-3 py-2">
                {erro}
              </p>
            )}
            {sucesso && (
              <p className="text-body-md text-on-secondary-container bg-secondary-fixed/30 border border-secondary-fixed-dim rounded px-3 py-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Catálogo registrado como pendente. Redirecionando…
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <Link
                href="/catalogos"
                className="px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={!arquivo || !nome || enviando}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                {enviando ? "Enviando…" : "Enviar base"}
              </button>
            </div>
          </div>
        </form>

        {/* Estrutura requerida */}
        <aside className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm h-fit">
          <h2 className="text-headline-sm text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">table_chart</span>
            Estrutura requerida
          </h2>
          <p className="text-body-md text-on-surface-variant mb-3">
            Para planilhas (CSV/XLSX), as colunas mínimas são:
          </p>
          <ul className="space-y-2">
            {[
              ["codigo_peca", "obrigatório"],
              ["descricao", "obrigatório"],
              ["numero_produto", "opcional"],
              ["unidade", "opcional"],
            ].map(([col, req]) => (
              <li key={col} className="flex items-center justify-between gap-2">
                <code className="font-mono text-code-md text-primary bg-surface-container-low px-2 py-0.5 rounded">
                  {col}
                </code>
                <span
                  className={`text-label-sm uppercase ${
                    req === "obrigatório" ? "text-error" : "text-on-surface-variant"
                  }`}
                >
                  {req}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-label-sm text-on-surface-variant mt-4 border-t border-outline-variant pt-3">
            PDFs com layout novo precisam de configuração no pipeline antes de processar
            (catalog_configs.py).
          </p>
        </aside>
      </div>
    </div>
  );
}
