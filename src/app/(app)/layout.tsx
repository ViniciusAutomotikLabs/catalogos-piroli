import { redirect } from "next/navigation";
import { NavShell } from "@/components/shell/nav-shell";
import { Footer } from "@/components/shell/footer";
import { getContextoLoja } from "@/lib/loja";
import { sair } from "@/lib/actions/auth";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let contexto = null;
  try {
    contexto = await getContextoLoja();
  } catch {
    redirect("/login");
  }
  if (!contexto) redirect("/login");

  // Super admin sem loja vinculada opera no console SaaS, não no tenant.
  if (!contexto.lojaId && contexto.isSuperAdmin) redirect("/admin");

  if (!contexto.lojaId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 max-w-md text-center shadow-md">
          <span className="material-symbols-outlined text-error text-5xl">storefront</span>
          <h1 className="text-headline-md text-primary mt-4 mb-2">
            Conta sem loja vinculada
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Seu usuário ainda não está vinculado a nenhuma revenda. Peça ao dono
            da loja para convidá-lo.
          </p>
          <form action={sair} className="mt-6">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Sair
            </button>
          </form>
        </div>
      </div>
    );
  }

  const modulos = contexto.modulos ? Array.from(contexto.modulos) : null;

  return (
    <>
      <NavShell lojaNome={contexto.loja?.nome} modulos={modulos} isSuperAdmin={contexto.isSuperAdmin} />
      <main className="lg:ml-64 flex-1 p-4 md:p-8 bg-background">
        <div className="max-w-[1440px] mx-auto space-y-8">{children}</div>
      </main>
      <Footer />
    </>
  );
}
