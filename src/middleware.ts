import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// middleware.ts é o caminho estável na Vercel; proxy.ts (Next 16) falha em produção
// com Internal Server Error em alguns deploys (manifest / bundling).
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
