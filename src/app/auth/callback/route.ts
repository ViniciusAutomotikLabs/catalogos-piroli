import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback PKCE / magic-link / invite do Supabase Auth.
 * Site URL e Redirect URLs devem incluir https://erp.autopecas.tech/auth/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/inicio";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/inicio";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const login = new URL("/login", origin);
  login.searchParams.set("erro", "link");
  return NextResponse.redirect(login);
}
