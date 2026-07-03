"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";

/**
 * Coordena o estado do drawer de navegação (mobile) entre o Header (botão
 * hambúrguer) e a Sidebar (drawer sobreposto). Em telas `lg+` a sidebar é
 * fixa e o estado é irrelevante.
 */
export function NavShell({ lojaNome }: { lojaNome?: string | null }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  const fechar = useCallback(() => setAberto(false), []);

  // Fecha o drawer ao navegar para outra rota (mobile).
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  // Fecha no Escape e trava o scroll do body enquanto o drawer está aberto.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <>
      <Sidebar lojaNome={lojaNome} open={aberto} onClose={fechar} />
      <Header onOpenMenu={() => setAberto(true)} />
      {aberto && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          aria-hidden="true"
          onClick={fechar}
        />
      )}
    </>
  );
}
