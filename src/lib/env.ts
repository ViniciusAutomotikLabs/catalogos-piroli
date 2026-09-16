function firstDefined(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/** Variáveis públicas do Supabase — usadas no browser e no middleware. */
export function getSupabasePublicEnv() {
  const url = firstDefined(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL
  );
  const key = firstDefined(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY
  );
  return { url, key };
}

/**
 * Chave service_role (SERVER-ONLY). Usada para escritas privilegiadas que a RLS
 * bloqueia para `authenticated` (ex.: débito no ledger de tokens, log de uso de IA).
 * NUNCA expor no browser. Retorna undefined se não configurada.
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  return firstDefined(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY
  );
}

/** Configuração do módulo de IA (DGX/Ollama via Tailscale). */
export function getOllamaEnv() {
  return {
    baseUrl: firstDefined(process.env.OLLAMA_BASE_URL),
    model: firstDefined(process.env.OLLAMA_MODEL) ?? "llama3.1",
  };
}

export function requireSupabasePublicEnv() {
  const { url, key } = getSupabasePublicEnv();
  if (!url || !key) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel (Production + Preview) e faça redeploy."
    );
  }
  return { url, key };
}
