import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ERP AutoPeças — Balcão no celular",
  description:
    "ERP de balcão para autopeças: busca, estoque, vendas e caixa — no PC e no celular.",
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-sidebar text-on-sidebar">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 70% 20%, rgba(37,99,235,0.35), transparent), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(5,150,105,0.18), transparent), linear-gradient(165deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <main className="relative z-10 flex flex-1 flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined filled text-[32px]">
                precision_manufacturing
              </span>
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-primary">
                AutoPeças
              </p>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                ERP AutoPeças
              </h1>
            </div>
          </div>

          <p className="max-w-xl text-lg leading-relaxed text-on-sidebar-variant sm:text-xl">
            ERP de balcão no celular — busca, estoque e vendas sem depender do
            PC da loja.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-8 text-label-sm uppercase tracking-wide text-on-primary shadow-md transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            >
              Entrar
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
            <span className="text-sm text-on-sidebar-variant">
              erp.autopecas.tech
            </span>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 px-6 py-4 text-center text-xs text-on-sidebar-variant">
        Piroli Autopeças · Catálogo consolidado · ERP 2.0
      </footer>
    </div>
  );
}
