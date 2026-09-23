"use client";

import { useState } from "react";
import { addToCart, type CartItem } from "@/lib/cart";
import type { AgregadoItem } from "@/lib/agregados";

type Props = {
  principal: Pick<CartItem, "produtoId" | "codigo" | "descricao" | "fabricante" | "fotoUrl">;
  agregados: AgregadoItem[];
};

/** Adiciona a peça principal + todos os agregados ao orçamento local. */
export function AdicionarAgregadosButton({ principal, agregados }: Props) {
  const [adicionado, setAdicionado] = useState(false);
  if (agregados.length === 0) return null;

  function handleClick() {
    addToCart({
      produtoId: principal.produtoId,
      codigo: principal.codigo,
      descricao: principal.descricao,
      fabricante: principal.fabricante,
      fotoUrl: principal.fotoUrl,
      precoUnitario: 0,
    });
    for (const a of agregados) {
      addToCart({
        produtoId: a.produtoRelacionadoId,
        codigo: a.codigo,
        descricao: a.titulo,
        fabricante: a.fabricante,
        fotoUrl: a.fotoUrl,
        quantidade: a.quantidadeSugerida,
        precoUnitario: a.preco ?? 0,
      });
    }
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Adicionar peça + agregados ao orçamento"
      aria-label="Adicionar peça e agregados ao orçamento"
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        adicionado
          ? "border-secondary-fixed-dim bg-secondary-container text-on-secondary-container"
          : "border-outline-variant bg-surface text-primary hover:border-primary hover:bg-primary/5"
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">
        {adicionado ? "check" : "add_shopping_cart"}
      </span>
      {adicionado ? "Adicionado" : "+ Agregados"}
    </button>
  );
}
