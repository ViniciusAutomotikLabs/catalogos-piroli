"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";

export type EstadoAdmin = { erro?: string; ok?: boolean } | null;

/**
 * Liga/desliga um módulo para uma loja (entitlement do SaaS).
 * Dupla proteção: guard de super admin no código + RLS `loja_modulos_write_super`.
 */
export async function alternarModulo(
  lojaId: number,
  moduloChave: string,
  ativo: boolean
): Promise<EstadoAdmin> {
  const contexto = await getContextoLoja();
  if (!contexto?.isSuperAdmin) return { erro: "Acesso restrito a super admin." };
  if (!Number.isFinite(lojaId) || lojaId <= 0) return { erro: "Loja inválida." };

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { error } = await sb.from("loja_modulos").upsert(
    {
      loja_id: lojaId,
      modulo_chave: moduloChave,
      ativo,
      criado_por: contexto.user?.id ?? null,
    },
    { onConflict: "loja_id,modulo_chave" }
  );

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Kill switch global de um módulo (afeta todas as lojas). Só super admin.
 */
export async function alternarModuloGlobal(
  moduloChave: string,
  ativoGlobal: boolean
): Promise<EstadoAdmin> {
  const contexto = await getContextoLoja();
  if (!contexto?.isSuperAdmin) return { erro: "Acesso restrito a super admin." };

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { error } = await sb
    .from("modulos")
    .update({ ativo_global: ativoGlobal })
    .eq("chave", moduloChave);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true };
}
