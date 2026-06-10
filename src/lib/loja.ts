import { cache } from "react";
import { createClient } from "./supabase/server";
import { getSupabasePublicEnv } from "./env";

/**
 * Contexto da loja do usuário logado (1 revenda = 1 loja).
 * Cacheado por request para evitar queries repetidas entre layout e páginas.
 */
export const getContextoLoja = cache(async () => {
  const { url, key } = getSupabasePublicEnv();
  if (!url || !key) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("membros_loja")
    .select("loja_id, papel, lojas(id, nome, cnpj, telefone_whatsapp, logo_url)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return {
    user,
    papel: data?.papel ?? null,
    lojaId: data?.loja_id ?? null,
    loja: data?.lojas ?? null,
  };
});
