"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarVendaDeOrcamento } from "@/lib/actions/vendas";
import { getCart, clearCart, CART_EVENT, type CartItem } from "@/lib/cart";

export function BotaoConverterEmVenda({
  clienteId,
}: {
  clienteId: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function converter() {
    const itens: CartItem[] = getCart();
    if (!itens.length) {
      setErro("O orçamento está vazio.");
      return;
    }

    const semCodigo = itens.filter((i) => !i.codigo?.trim());
    if (semCodigo.length > 0) {
      setErro(
        `${semCodigo.length} item(ns) sem código SS/espelho — adicione pela busca de estoque ou peça com código para reservar saldo.`
      );
      return;
    }

    startTransition(async () => {
      setErro(null);
      setAviso(null);
      const r = await criarVendaDeOrcamento(
        null,
        itens.map((i) => ({
          produtoId: i.produtoId,
          codigo: i.codigo.trim(),
          descricao: i.descricao,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
        })),
        { clienteId }
      );
      if (r.erro || !r.vendaId) {
        setErro(r.erro ?? "Falha ao criar venda.");
        return;
      }
      clearCart();
      window.dispatchEvent(new Event(CART_EVENT));
      setAviso(`Venda #${r.vendaId} criada — abrindo…`);
      router.push(`/vendas/${r.vendaId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={converter}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
        {pending ? "Criando…" : "Converter em venda"}
      </button>
      {erro && <p className="text-body-md text-error">{erro}</p>}
      {aviso && !erro && (
        <p className="text-body-md text-on-primary-container bg-primary-container/40 rounded-lg px-3 py-2">
          {aviso}
        </p>
      )}
    </div>
  );
}
