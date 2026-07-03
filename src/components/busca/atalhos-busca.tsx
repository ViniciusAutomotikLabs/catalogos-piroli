"use client";

import { useEffect } from "react";

/**
 * Atalhos de teclado do balcão para a busca.
 * `/` foca o campo de busca (padrão de apps de produtividade); `Esc` tira o
 * foco. Ignora quando o usuário já está digitando em outro campo.
 */
export function AtalhosBusca({ targetId }: { targetId: string }) {
  useEffect(() => {
    const digitandoEm = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const input = document.getElementById(targetId) as HTMLInputElement | null;
      if (!input) return;

      if (e.key === "/" && !digitandoEm(e.target)) {
        e.preventDefault();
        input.focus();
        input.select();
      } else if (e.key === "Escape" && document.activeElement === input) {
        input.blur();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [targetId]);

  return null;
}
