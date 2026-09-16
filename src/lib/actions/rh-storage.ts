"use server";

import { randomUUID } from "node:crypto";
import { getContextoLoja } from "@/lib/loja";
import { createAdminClient } from "@/lib/supabase/admin";

const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;
const PASTAS = ["documentos", "atestados", "advertencias"] as const;
const MIME_OK = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

export type ResultadoUploadRh = { path?: string; erro?: string };
export type ResultadoUrlRh = { url?: string; erro?: string };

function pastaOk(pasta: string): pasta is (typeof PASTAS)[number] {
  return (PASTAS as readonly string[]).includes(pasta);
}

function pathDaOrg(path: string, organizacaoId: number): boolean {
  const prefixo = `${organizacaoId}/`;
  return path.startsWith(prefixo) && !path.includes("..") && !path.startsWith("/");
}

/**
 * Upload no bucket privado `rh` via service_role (o cliente browser não persistia
 * o objeto — o path ia para o banco e o Storage respondia "Object not found").
 * Path sempre `${organizacaoId}/${pasta}/${uuid}.ext`.
 */
export async function uploadArquivoRh(formData: FormData): Promise<ResultadoUploadRh> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };

  const admin = createAdminClient();
  if (!admin) return { erro: "Upload indisponível: service_role não configurada." };

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione um arquivo." };
  if (arquivo.size > TAMANHO_MAX_BYTES) return { erro: "Arquivo muito grande. Máximo 10 MB." };

  const mime = (arquivo.type || "").toLowerCase();
  if (mime && !MIME_OK.has(mime) && !mime.startsWith("image/")) {
    return { erro: "Formato não suportado. Use PDF ou imagem." };
  }

  const pasta = String(formData.get("pasta") ?? "documentos");
  if (!pastaOk(pasta)) return { erro: "Pasta inválida." };

  const extMatch = arquivo.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = (extMatch?.[1] ?? (mime.includes("pdf") ? "pdf" : "bin")).toLowerCase();
  const path = `${contexto.organizacaoId}/${pasta}/${randomUUID()}.${ext}`;

  const buf = Buffer.from(await arquivo.arrayBuffer());
  const { error } = await admin.storage.from("rh").upload(path, buf, {
    upsert: false,
    contentType: mime || undefined,
  });
  if (error) return { erro: `Falha no upload: ${error.message}` };
  return { path };
}

/** Signed URL (1h) para um path do bucket `rh`, só se for da organização do usuário. */
export async function urlAssinadaRh(path: string): Promise<ResultadoUrlRh> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  if (!pathDaOrg(path, contexto.organizacaoId)) return { erro: "Arquivo inválido." };

  const admin = createAdminClient();
  if (!admin) return { erro: "Leitura indisponível: service_role não configurada." };

  const { data, error } = await admin.storage.from("rh").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    return {
      erro:
        error?.message === "Object not found" || /not found/i.test(error?.message ?? "")
          ? "Arquivo não encontrado no storage. Remova e envie de novo."
          : (error?.message ?? "Não foi possível abrir o arquivo."),
    };
  }
  return { url: data.signedUrl };
}
