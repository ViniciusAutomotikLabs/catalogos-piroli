import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { getSupabasePublicEnv } from "./env";
import { MODULO_CHAVES, moduloLiberado, type ModuloChave } from "./modulos";

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

  const lojaId = data?.loja_id ?? null;
  const { modulos, isSuperAdmin } = await carregarEntitlements(supabase, lojaId);
  const organizacaoId = await carregarOrganizacaoId(supabase, lojaId);

  return {
    user,
    papel: data?.papel ?? null,
    lojaId,
    organizacaoId,
    loja: data?.lojas ?? null,
    /** Módulos ativos da loja. `null` = sem enforcement (fallback pré-migration). */
    modulos,
    isSuperAdmin,
  };
});

/**
 * Resolve a organização da loja (Pessoas é escopada por organização). Retorna null
 * se a coluna/tabela ainda não existe (pré-migration 007) — o módulo Pessoas então
 * avisa que a organização não está configurada.
 */
async function carregarOrganizacaoId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lojaId: number | null
): Promise<number | null> {
  if (!lojaId) return null;
  try {
    const sb = supabase as unknown as SupabaseClient;
    const { data } = await sb
      .from("lojas")
      .select("organizacao_id")
      .eq("id", lojaId)
      .maybeSingle();
    return (data?.organizacao_id as number | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Guard de rota por módulo. Use no topo de páginas/Server Actions de um módulo:
 * `await requireModulo("pessoas")`. Redireciona para "/" se a loja não tiver o
 * módulo ativo. Respeita o fallback (modulos = null → liberado).
 */
export async function requireModulo(modulo: ModuloChave): Promise<void> {
  const contexto = await getContextoLoja();
  if (!moduloLiberado(modulo, contexto?.modulos ?? null)) {
    redirect("/");
  }
}

/**
 * Carrega os módulos ativos da loja e a flag de super admin.
 *
 * As tabelas de entitlements (`loja_modulos`, `super_admins`) não estão nos tipos
 * gerados do Supabase e podem ainda não existir no banco. Por isso usamos um cliente
 * sem tipagem e, em caso de erro (tabela ausente) ou ausência de registros,
 * retornamos `modulos = null` para NÃO aplicar enforcement — o app segue funcionando
 * até a migration 008 ser aplicada e os módulos semeados por loja.
 */
async function carregarEntitlements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lojaId: number | null
): Promise<{ modulos: Set<ModuloChave> | null; isSuperAdmin: boolean }> {
  const sb = supabase as unknown as SupabaseClient;

  let isSuperAdmin = false;
  try {
    const { data: sa } = await sb
      .from("super_admins")
      .select("user_id")
      .limit(1)
      .maybeSingle();
    isSuperAdmin = Boolean(sa);
  } catch {
    isSuperAdmin = false;
  }

  if (!lojaId) return { modulos: null, isSuperAdmin };

  try {
    const { data, error } = await sb
      .from("loja_modulos")
      .select("modulo_chave, ativo, valido_ate")
      .eq("loja_id", lojaId)
      .eq("ativo", true);

    if (error || !data || data.length === 0) {
      // Tabela ausente ou loja sem entitlements configurados: sem enforcement.
      return { modulos: null, isSuperAdmin };
    }

    const validas = new Set<string>(MODULO_CHAVES);
    const hoje = new Date().toISOString().slice(0, 10);
    const ativos = new Set<ModuloChave>();
    for (const row of data as Array<{
      modulo_chave: string;
      valido_ate: string | null;
    }>) {
      if (!validas.has(row.modulo_chave)) continue;
      if (row.valido_ate && row.valido_ate < hoje) continue;
      ativos.add(row.modulo_chave as ModuloChave);
    }
    return { modulos: ativos, isSuperAdmin };
  } catch {
    return { modulos: null, isSuperAdmin };
  }
}
