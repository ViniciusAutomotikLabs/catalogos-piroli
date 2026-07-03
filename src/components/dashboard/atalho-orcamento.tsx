"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_EVENT, cartCount } from "@/lib/cart";

/**
 * Chip compacto de "orçamento em andamento" para a barra de status do
 * dashboard. Client-side porque lê a contagem do carrinho no localStorage e
 * reage às mudanças (`CART_EVENT`), igual à sidebar. Só aparece quando há
 * itens — é informação operacional, não um atalho que duplica a navegação.
 */
export function OrcamentoStatusChip() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(cartCount());
    update();
    window.addEventListener(CART_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CART_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/orcamento"
      className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-fixed/40 px-3 py-1.5 text-label-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
      Orçamento em andamento
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-on-primary">
        {count}
      </span>
    </Link>
  );
}
