import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";
import { getContextoLoja } from "@/lib/loja";

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

  if (!contexto.lojaId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 max-w-md text-center shadow-sm">
          <span className="material-symbols-outlined text-error text-5xl">storefront</span>
          <h1 className="text-headline-md text-primary mt-4 mb-2">
            Conta sem loja vinculada
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Seu usuário ainda não está vinculado a nenhuma revenda. Peça ao dono
            da loja para convidá-lo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Sidebar lojaNome={contexto.loja?.nome} />
      <Header />
      <main className="ml-64 flex-1 p-8 bg-background">
        <div className="max-w-[1440px] mx-auto space-y-8">{children}</div>
      </main>
      <Footer />
    </>
  );
}
