"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CART_EVENT, cartCount } from "@/lib/cart";
import { useFocusTrap } from "@/lib/use-focus-trap";

const ITEMS = [
  { href: "/", icon: "home", label: "Início" },
  { href: "/busca", icon: "search", label: "Busca" },
  { href: "/orcamento", icon: "shopping_cart", label: "Orçamento", showCartBadge: true },
  { href: "/veiculo", icon: "directions_car", label: "Veículo" },
  { href: "/catalogos", icon: "menu_book", label: "Catálogos" },
  { href: "/agregados", icon: "construction", label: "Agregados" },
  { href: "/historico", icon: "history", label: "Histórico" },
  { href: "/clientes", icon: "group", label: "CRM" },
  { href: "/configuracoes", icon: "settings", label: "Configurações" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/busca") return pathname.startsWith("/busca") || pathname.startsWith("/produtos");
  return pathname.startsWith(href);
}

type SidebarProps = {
  lojaNome?: string | null;
  open?: boolean;
  onClose?: () => void;
};

export function Sidebar({ lojaNome, open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  // Focus trap ativo apenas quando o drawer mobile está aberto. Em `lg+` a
  // sidebar é fixa (`open` sempre false), então o trap fica inativo.
  const navRef = useFocusTrap<HTMLElement>(open, onClose);

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
    <nav
      ref={navRef}
      aria-label="Navegação principal"
      className={`bg-sidebar h-screen w-64 fixed left-0 top-0 border-r border-sidebar-border flex flex-col py-6 px-3 z-50 transition-transform duration-200 ease-out lg:translate-x-0 focus:outline-none ${
        open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      }`}
    >
      <div className="mb-8 flex items-start justify-between px-1">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm">
            <span className="material-symbols-outlined filled text-[22px]">settings_suggest</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-headline-sm font-black text-white tracking-tight leading-none">
              AUTO-PEÇAS
            </h1>
            <p className="mt-1 truncate text-label-sm font-medium text-on-sidebar-variant">
              {lojaNome ?? "Unidade Matriz"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar menu"
          className="lg:hidden -mr-1 p-1.5 rounded-lg text-on-sidebar-variant hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-primary"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <ul className="flex flex-col gap-1 overflow-y-auto">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-lg bg-primary/20 text-white font-semibold border-l-4 border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-primary"
                    : "flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-on-sidebar-variant hover:bg-white/5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-primary"
                }
              >
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    active ? "filled text-inverse-primary" : ""
                  }`}
                >
                  {item.icon}
                </span>
                <span className="text-label-sm flex-1">{item.label}</span>
                {"showCartBadge" in item && item.showCartBadge && count > 0 && (
                  <span className="bg-primary text-on-primary text-label-sm rounded-full min-w-5 h-5 flex items-center justify-center px-1 shadow-sm">
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
