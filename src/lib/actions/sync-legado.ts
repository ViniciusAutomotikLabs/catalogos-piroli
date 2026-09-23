"use server";

import { revalidatePath } from "next/cache";
import { createErpClient } from "@/lib/supabase/erp";
import { getContextoLoja } from "@/lib/loja";

export async function obterSyncLegadoAtivo(): Promise<boolean> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return true;
  const sb = await createErpClient();
  const { data } = await sb
    .from("organizacoes")
    .select("sync_legado_ativo")
    .eq("id", contexto.organizacaoId)
    .maybeSingle();
  return data?.sync_legado_ativo !== false;
}

export async function definirSyncLegadoAtivo(
  ativo: boolean
): Promise<{ ok: boolean; erro?: string }> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) {
    return { ok: false, erro: "Organização não configurada." };
  }
  if (contexto.papel !== "dono" && !contexto.isSuperAdmin) {
    return { ok: false, erro: "Apenas o dono da loja pode alterar a sincronização." };
  }

  const sb = await createErpClient();
  const { error } = await sb
    .from("organizacoes")
    .update({ sync_legado_ativo: ativo })
    .eq("id", contexto.organizacaoId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/configuracoes");
  revalidatePath("/estoque");
  return { ok: true };
}
