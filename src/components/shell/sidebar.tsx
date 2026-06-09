"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", icon: "home", label: "Início" },
  { href: "/busca", icon: "search", label: "Busca" },
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
                <span className="text-label-sm">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
