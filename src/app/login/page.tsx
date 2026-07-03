"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildContatoLojaUrl } from "@/lib/whatsapp";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) {
      setErro("E-mail ou senha inválidos. Tente novamente.");
      setCarregando(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center text-on-surface p-4 md:p-0 flex-1 overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #f8fafc, #eef2f7)",
          backgroundSize: "24px 24px, 100% 100%",
        }}
      />
      <main className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 shadow-lg flex flex-col gap-8">
          <header className="flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-md">
              <span className="material-symbols-outlined filled text-on-primary text-[30px]">
                precision_manufacturing
              </span>
            </div>
            <h1 className="text-headline-lg font-black text-on-surface tracking-tight">
              AutoPeças
            </h1>
            <p className="text-label-sm text-on-surface-variant uppercase mt-1 tracking-widest">
              Catálogo Industrial
            </p>
          </header>

          <form className="flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant" htmlFor="email">
                E-mail de acesso
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@loja.com.br"
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-label-sm text-on-surface-variant" htmlFor="password">
                  Senha
                </label>
                <a
                  className="text-label-sm text-primary hover:text-primary-container transition-colors underline decoration-primary/30 underline-offset-2"
                  href={buildContatoLojaUrl(
                    null,
                    "Olá, preciso de ajuda para recuperar meu acesso ao Catálogo Industrial."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                  lock
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg font-mono text-code-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors tracking-widest"
                />
              </div>
            </div>

            {erro && (
              <p className="text-body-md text-error bg-error-container/50 border border-error/30 rounded-lg px-3 py-2">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full mt-2 bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary text-label-sm uppercase py-3 rounded-lg border border-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary outline-none transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {carregando ? "Entrando…" : "Entrar"}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>
        </div>

        <footer className="mt-4 flex items-center justify-center gap-2 text-on-surface-variant opacity-80">
          <span className="material-symbols-outlined text-[16px]">database</span>
          <span className="text-label-sm uppercase tracking-wide">
            Catálogo consolidado · 100+ fontes
          </span>
        </footer>
      </main>
    </div>
  );
}
