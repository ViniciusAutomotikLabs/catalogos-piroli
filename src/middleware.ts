import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Força runtime Node.js: o edge runtime falhava com o Supabase SSR na Vercel
  // (MIDDLEWARE_INVOCATION_FAILED). Ver PROJETO_HISTORICO.md § 12.
  runtime: "nodejs",
  matcher: [
    /*
     * Executa em todas as rotas, exceto assets estáticos e imagens.
     * Ajuste aqui se novas extensões precisarem escapar do middleware.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
