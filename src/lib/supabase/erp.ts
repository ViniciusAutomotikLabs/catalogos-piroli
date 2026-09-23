import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Cliente sem tipagem gerada — tabelas ERP novas (espelho, vendas, financeiro)
 * ainda não estão em `Database` até regenerar types após a migration 015.
 */
export async function createErpClient(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}
