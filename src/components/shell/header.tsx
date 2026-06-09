"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_EVENT, cartCount } from "@/lib/cart";

export function Header() {
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

  return (
    <header className="bg-surface sticky top-0 w-full z-40 border-b border-outline-variant shadow-sm flex items-center justify-between px-8 py-4 ml-64">
      <div className="text-headline-md text-primary font-bold uppercase">
        Catálogo Industrial
      </div>
      <div className="flex items-center gap-4 text-primary">
        <Link
          href="/orcamento"
          className="relative p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          title="Carrinho de orçamento"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-secondary text-on-secondary text-label-sm rounded-full min-w-5 h-5 flex items-center justify-center px-1">
              {count}
            </span>
          )}
        </Link>
        <Link
          href="/configuracoes"
          className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          title="Perfil e configurações"
        >
          <span className="material-symbols-outlined">person</span>
        </Link>
      </div>
    </header>
  );
}
