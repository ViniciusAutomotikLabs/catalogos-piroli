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

  // MVP 1.0: 1 usuário = 1 loja. O modelo (membros_loja) já é multi-tenant;
  // ordenamos por loja_id para que a escolha seja determinística caso um
  // usuário venha a pertencer a mais de uma loja no futuro (troca de loja
  // vira uma feature de UI no MVP 2.0+).
  const { data } = await supabase
    .from("membros_loja")
    .select("loja_id, papel, lojas(id, nome, cnpj, telefone_whatsapp, logo_url)")
    .eq("user_id", user.id)
    .order("loja_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    user,
    papel: data?.papel ?? null,
    lojaId: data?.loja_id ?? null,
    loja: data?.lojas ?? null,
  };
});
