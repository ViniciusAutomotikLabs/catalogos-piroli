import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/env";

/**
 * Cliente Supabase com service_role — SERVER-ONLY.
 *
 * Bypassa RLS: use APENAS em escritas privilegiadas controladas server-side
 * (ex.: débito no `token_ledger`, log em `ia_uso`, confirmação de recarga por
 * webhook). Nunca importar no browser. Retorna null se a chave não estiver
 * configurada, para o chamador degradar com clareza.
 */
export function createAdminClient(): SupabaseClient | null {
  const { url } = getSupabasePublicEnv();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
