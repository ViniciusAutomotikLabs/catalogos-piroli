import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { requireSupabasePublicEnv } from "@/lib/env";

export function createClient() {
  const { url, key } = requireSupabasePublicEnv();
  return createBrowserClient<Database>(url, key);
}
