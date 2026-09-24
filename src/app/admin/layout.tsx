import { redirect } from "next/navigation";
import Link from "next/link";
import { getContextoLoja } from "@/lib/loja";
import { sair } from "@/lib/actions/auth";

/**
 * Console SaaS do super admin — FORA do tenant (não exige loja vinculada).
 * Guard: só super admin entra; qualquer outro vai para o app/login.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let contexto = null;
  try {
    contexto = await getContextoLoja();
  } catch {
    redirect("/login");
  }
  if (!contexto) redirect("/login");
  if (!contexto.isSuperAdmin) redirect("/inicio");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm">
              <span className="material-symbols-outlined filled text-[22px]">admin_panel_settings</span>
            </span>
            <div>
              <h1 className="text-headline-sm text-on-surface font-black leading-none">Painel Super Admin</h1>
              <p className="text-label-sm text-on-surface-variant mt-0.5">ERP 2.0 · SaaS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {contexto.lojaId && (
              <Link
                href="/inicio"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase"
              >
                <span className="material-symbols-outlined text-[18px]">storefront</span>
                Ir para a loja
              </Link>
            )}
            <form action={sair}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-8">{children}</main>
    </div>
  );
}
