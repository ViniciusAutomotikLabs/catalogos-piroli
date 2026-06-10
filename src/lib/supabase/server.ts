import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { getSupabasePublicEnv } from "@/lib/env";

export async function createClient() {
  const { url, key } = getSupabasePublicEnv();
  if (!url || !key) {
    throw new Error("SUPABASE_ENV_MISSING");
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component: refresh de cookies em Route Handlers / Server Actions.
        }
      },
    },
  });
}
