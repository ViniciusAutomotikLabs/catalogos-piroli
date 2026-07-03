"use client";

import { useEffect, useRef } from "react";

const SELETOR_FOCAVEL = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Focus trap acessível para modais e drawer (FE-12).
 *
 * Quando `ativo` é verdadeiro:
 * - move o foco para o primeiro elemento focável dentro do container;
 * - mantém o foco circulando com Tab / Shift+Tab (não escapa para o fundo);
 * - fecha via Escape chamando `aoFechar`;
 * - restaura o foco para o elemento que estava ativo antes de abrir.
 *
 * Retorna a `ref` que deve ser aplicada no elemento container (dialog/nav).
 */
export function useFocusTrap<T extends HTMLElement>(
  ativo: boolean,
  aoFechar?: () => void
) {
  const ref = useRef<T>(null);
  // Guarda o callback numa ref para não re-executar o efeito a cada render
  // quando `aoFechar` é uma função inline.
  const aoFecharRef = useRef(aoFechar);
  aoFecharRef.current = aoFechar;

  useEffect(() => {
    if (!ativo) return;
    const container = ref.current;
    if (!container) return;

    const focoAnterior = document.activeElement as HTMLElement | null;

    const focaveis = () =>
      Array.from(container.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    const itensIniciais = focaveis();
    (itensIniciais[0] ?? container).focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        aoFecharRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;

      const itens = focaveis();
      if (itens.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const atual = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (atual === primeiro || !container.contains(atual)) {
          e.preventDefault();
          ultimo.focus();
        }
      } else if (atual === ultimo || !container.contains(atual)) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      focoAnterior?.focus?.();
    };
  }, [ativo]);

  return ref;
}
