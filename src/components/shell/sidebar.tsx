"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CART_EVENT, cartCount } from "@/lib/cart";

const ITEMS = [
  { href: "/", icon: "home", label: "Início" },
  { href: "/busca", icon: "search", label: "Busca" },
  { href: "/orcamento", icon: "shopping_cart", label: "Orçamento", showCartBadge: true },
  { href: "/veiculo", icon: "directions_car", label: "Veículo" },
  { href: "/catalogos", icon: "menu_book", label: "Catálogos" },
  { href: "/historico", icon: "history", label: "Histórico" },
  { href: "/clientes", icon: "group", label: "CRM" },
  { href: "/configuracoes", icon: "settings", label: "Configurações" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/busca") return pathname.startsWith("/busca") || pathname.startsWith("/produtos");
  return pathname.startsWith(href);
}

export function Sidebar({ lojaNome }: { lojaNome?: string | null }) {
  const pathname = usePathname();
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
    <nav className="bg-primary h-screen w-64 fixed left-0 top-0 border-r border-outline-variant flex flex-col py-6 px-4 z-50">
      <div className="mb-8">
        <h1 className="text-headline-lg font-black text-on-primary tracking-tighter">
          AUTO-PEÇAS
        </h1>
        <p className="text-label-sm text-primary-fixed-dim">
          {lojaNome ?? "Unidade Matriz"}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={
                  active
                    ? "flex items-center gap-3 px-4 py-3 rounded-sm bg-primary-fixed-dim text-on-primary-fixed font-bold border-l-4 border-secondary transition-colors"
                    : "flex items-center gap-3 px-4 py-3 rounded-sm text-on-primary-container hover:bg-primary-fixed-dim/20 transition-colors"
                }
              >
                <span className={`material-symbols-outlined ${active ? "filled" : ""}`}>
                  {item.icon}
                </span>
                <span className="text-label-sm flex-1">{item.label}</span>
                {"showCartBadge" in item && item.showCartBadge && count > 0 && (
                  <span className="bg-secondary text-on-secondary text-label-sm rounded-full min-w-5 h-5 flex items-center justify-center px-1">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
