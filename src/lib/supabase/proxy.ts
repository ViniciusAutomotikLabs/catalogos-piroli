import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/auth/callback")) return true;
  if (pathname.startsWith("/api/cep")) return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabasePublicEnv();

  if (!url || !key) {
    // Sem env: deixa landing e /login carregarem; demais rotas mostram aviso
    if (isPublicPath(request.nextUrl.pathname)) {
      return NextResponse.next();
    }
    return new NextResponse(
      "App não configurado: adicione NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel e redeploy.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname.startsWith("/login");
  const isLanding = pathname === "/";

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (isLoginRoute || isLanding)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/inicio";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
