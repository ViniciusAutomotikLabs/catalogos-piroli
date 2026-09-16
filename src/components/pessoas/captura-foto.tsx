"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** Organização dona da foto (primeiro segmento do path no bucket). */
  organizacaoId: number;
  /** Path já salvo (edição) para pré-visualizar. */
  valorInicial?: string | null;
  /** Nome do input hidden que carrega o path para a server action. */
  name?: string;
};

const TAMANHO_MAX_MB = 5;
const LARGURA = 480;
const ALTURA = 480;

/**
 * Captura de foto da pessoa: webcam (getUserMedia) com fallback para upload de arquivo.
 * Faz upload para o bucket privado `pessoas` e grava o PATH num input hidden — a foto
 * é exibida depois via signed URL gerada no servidor.
 */
export function CapturaFoto({ organizacaoId, valorInicial = null, name = "foto_url" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [path, setPath] = useState<string | null>(valorInicial);
  const [preview, setPreview] = useState<string | null>(null);
  const [camAtiva, setCamAtiva] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [suportaCam, setSuportaCam] = useState(true);

  useEffect(() => {
    setSuportaCam(
      typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
    );
  }, []);

  const pararCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamAtiva(false);
  }, []);

  useEffect(() => () => pararCam(), [pararCam]);

  // Carrega preview inicial (edição) via signed URL.
  useEffect(() => {
    if (!valorInicial) return;
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from("pessoas")
        .createSignedUrl(valorInicial, 3600);
      if (!cancelado && data?.signedUrl) setPreview(data.signedUrl);
    })();
    return () => {
      cancelado = true;
    };
  }, [valorInicial]);

  async function abrirCam() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: LARGURA, height: ALTURA, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      // Monta o <video> primeiro; o srcObject é anexado no efeito abaixo
      // (o elemento só existe no DOM depois de camAtiva=true).
      setCamAtiva(true);
    } catch {
      setErro("Não foi possível acessar a câmera. Use o upload de arquivo.");
      setSuportaCam(false);
    }
  }

  // Anexa o stream ao <video> assim que ele é montado.
  useEffect(() => {
    if (camAtiva && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [camAtiva]);

  async function capturar() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const lado = Math.min(video.videoWidth, video.videoHeight) || LARGURA;
    canvas.width = lado;
    canvas.height = lado;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Recorte central quadrado.
    const sx = (video.videoWidth - lado) / 2;
    const sy = (video.videoHeight - lado) / 2;
    ctx.drawImage(video, sx, sy, lado, lado, 0, 0, lado, lado);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.85)
    );
    pararCam();
    if (blob) await enviar(blob, "webcam.jpg");
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErro("Selecione uma imagem.");
      return;
    }
    if (f.size > TAMANHO_MAX_MB * 1024 * 1024) {
      setErro(`Imagem muito grande. Máximo ${TAMANHO_MAX_MB} MB.`);
      return;
    }
    await enviar(f, f.name);
  }

  async function enviar(blob: Blob, nomeArquivo: string) {
    setEnviando(true);
    setErro(null);
    try {
      const supabase = createClient();
      const ext = nomeArquivo.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now());
      const novoPath = `${organizacaoId}/tmp/${id}.${ext}`;
      const { error } = await supabase.storage
        .from("pessoas")
        .upload(novoPath, blob, {
          upsert: false,
          contentType: ext === "png" ? "image/png" : "image/jpeg",
        });
      if (error) {
        setErro(`Falha no upload: ${error.message}`);
        return;
      }
      // Remove foto anterior (best-effort) e atualiza estado.
      if (path && path !== novoPath) {
        await supabase.storage.from("pessoas").remove([path]);
      }
      setPath(novoPath);
      setPreview(URL.createObjectURL(blob));
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    if (path) {
      const supabase = createClient();
      await supabase.storage.from("pessoas").remove([path]).catch(() => {});
    }
    setPath(null);
    setPreview(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={path ?? ""} readOnly />

      <div className="flex items-start gap-4">
        {/* Área da imagem/câmera */}
        <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low flex items-center justify-center shrink-0">
          {camAtiva ? (
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Foto da pessoa" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-outline text-5xl">person</span>
          )}
          {enviando && (
            <div className="absolute inset-0 bg-scrim/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary animate-spin">progress_activity</span>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2">
          {camAtiva ? (
            <>
              <button
                type="button"
                onClick={capturar}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                Capturar
              </button>
              <button
                type="button"
                onClick={pararCam}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors text-label-sm uppercase"
              >
                Cancelar câmera
              </button>
            </>
          ) : (
            <>
              {suportaCam && (
                <button
                  type="button"
                  onClick={abrirCam}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  Usar câmera
                </button>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors text-label-sm uppercase"
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Enviar arquivo
              </button>
              {(path || preview) && (
                <button
                  type="button"
                  onClick={remover}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-error/40 text-error hover:bg-error-container/40 transition-colors text-label-sm uppercase"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Remover
                </button>
              )}
            </>
          )}
          <p className="text-label-sm text-on-surface-variant max-w-[180px]">
            Foto do cliente (webcam ou arquivo). Máx. {TAMANHO_MAX_MB} MB.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={onArquivo}
      />
      <canvas ref={canvasRef} className="hidden" />
      {erro && (
        <p className="text-body-md text-error bg-error-container/50 border border-error/30 rounded px-3 py-2">
          {erro}
        </p>
      )}
    </div>
  );
}
