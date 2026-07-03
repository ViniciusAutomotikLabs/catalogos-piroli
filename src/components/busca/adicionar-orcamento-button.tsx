"use client";

import { useState } from "react";
import { addToCart, type CartItem } from "@/lib/cart";

type Props = {
  item: Pick<CartItem, "produtoId" | "codigo" | "descricao" | "fabricante" | "fotoUrl">;
  className?: string;
};

/**
 * Botão "+ Orçamento" para a linha de resultado da busca. Reutiliza `addToCart`
 * (localStorage) com o mesmo formato de item usado na ficha do produto.
 */
export function AdicionarOrcamentoButton({ item, className }: Props) {
  const [adicionado, setAdicionado] = useState(false);

  function handleClick() {
    addToCart({
      produtoId: item.produtoId,
      codigo: item.codigo,
      descricao: item.descricao || "Peça",
      fabricante: item.fabricante,
      fotoUrl: item.fotoUrl,
      precoUnitario: 0,
    });
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={adicionado ? "Adicionado ao orçamento" : "Adicionar ao orçamento"}
      title="Adicionar ao orçamento"
      className={
        className ??
        `flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-label-sm uppercase border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          adicionado
            ? "bg-secondary-container border-secondary-fixed-dim text-on-secondary-container"
            : "bg-surface-container border-transparent text-primary hover:bg-primary hover:text-on-primary hover:border-primary"
        }`
      }
    >
      <span className="material-symbols-outlined text-[18px]">
        {adicionado ? "check" : "add_shopping_cart"}
      </span>
      <span className="hidden sm:inline">{adicionado ? "Adicionado" : "Orçamento"}</span>
    </button>
  );
}
