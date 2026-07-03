"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_EVENT, cartCount } from "@/lib/cart";

export function Header({ onOpenMenu }: { onOpenMenu?: () => void }) {
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
    <header className="bg-surface-container-lowest/80 backdrop-blur-md sticky top-0 w-full z-40 border-b border-outline-variant flex items-center gap-3 px-4 md:px-8 py-3 lg:ml-64">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menu de navegação"
        className="lg:hidden -ml-1 p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      {/* Busca global — sempre acessível no desktop (lg+) */}
      <form action="/busca" role="search" className="hidden lg:flex flex-1 max-w-xl">
        <div className="relative flex w-full items-center rounded-lg border border-outline-variant bg-surface-container-low transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <span className="material-symbols-outlined absolute left-3 text-outline text-[20px]">
            search
          </span>
          <input
            type="text"
            name="q"
            aria-label="Buscar peça por código, descrição ou referência"
            placeholder="Buscar peça por código, descrição ou referência…"
            className="h-10 w-full rounded-lg bg-transparent pl-10 pr-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none"
          />
        </div>
      </form>

      {/* Espaçador no mobile para empurrar os ícones à direita */}
      <div className="flex-1 lg:hidden" />

      <div className="flex items-center gap-1.5">
        <Link
          href="/busca"
          className="lg:hidden p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="Buscar peças"
          aria-label="Buscar peças"
        >
          <span className="material-symbols-outlined">search</span>
        </Link>
        <Link
          href="/orcamento"
          className="relative p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="Carrinho de orçamento"
          aria-label={count > 0 ? `Carrinho de orçamento, ${count} item(ns)` : "Carrinho de orçamento"}
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-on-primary text-label-sm rounded-full min-w-5 h-5 flex items-center justify-center px-1 shadow-sm">
              {count}
            </span>
          )}
        </Link>
        <Link
          href="/configuracoes"
          className="p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="Perfil e configurações"
          aria-label="Perfil e configurações"
        >
          <span className="material-symbols-outlined">person</span>
        </Link>
      </div>
    </header>
  );
}
