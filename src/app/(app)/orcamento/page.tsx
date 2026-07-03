"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CART_EVENT,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
  type CartItem,
} from "@/lib/cart";
import { salvarOrcamento } from "@/lib/actions/orcamentos";
import { OrcamentoBarraAcoes } from "@/components/orcamento/barra-acoes";

type ClienteOption = { id: number; nome: string; whatsapp: string | null };

const VALIDADE_DIAS = 5;

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OrcamentoPage() {
  const [itens, setItens] = useState<CartItem[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setItens(getCart());
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("clientes")
      .select("id, razao_social, nome_fantasia, telefone_whatsapp")
      .eq("ativo", true)
      .order("razao_social")
      .limit(200)
      .then(({ data }) => {
        setClientes(
          (data ?? []).map((c) => ({
            id: c.id,
            nome: c.nome_fantasia ?? c.razao_social,
            whatsapp: c.telefone_whatsapp,
          }))
        );
      });
  }, []);

  const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0);
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  async function handleSalvar() {
    setSalvando(true);
    setMensagem(null);
    const resultado = await salvarOrcamento(
      clienteId,
      itens.map((i) => ({
        produtoId: i.produtoId,
        descricao: i.descricao,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
      }))
    );
    setSalvando(false);
    if (resultado.ok) {
      clearCart();
      setMensagem(
        clienteId
          ? `Orçamento salvo! Veja o histórico de ${cliente?.nome ?? "cliente"} no CRM.`
          : "Orçamento salvo como rascunho!"
      );
    } else {
      setMensagem(resultado.erro ?? "Erro ao salvar.");
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">Carrinho de Orçamento</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {itens.length} item(ns) — preços manuais até o módulo de estoque (MVP 2.0)
          </p>
        </div>
        {itens.length > 0 && (
          <button
            onClick={() => clearCart()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:border-error hover:text-error transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
          >
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            Limpar Lista
          </button>
        )}
      </div>

      {mensagem && (
        <p className="text-body-md text-on-secondary-container bg-secondary-fixed/30 border border-secondary-fixed-dim rounded px-3 py-2">
          {mensagem}
          {clienteId && (
            <>
              {" "}
              <Link href={`/clientes/${clienteId}`} className="text-primary font-semibold hover:underline">
                Abrir perfil no CRM
              </Link>
            </>
          )}
        </p>
      )}

      {itens.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl py-16 flex flex-col items-center gap-2 shadow-sm">
          <span className="material-symbols-outlined text-outline text-5xl">shopping_cart_off</span>
          <p className="text-headline-sm text-on-surface">Orçamento vazio</p>
          <p className="text-body-md text-on-surface-variant">
            Adicione peças pelo botão <strong>Orçamento</strong> na ficha do produto.
          </p>
          <Link
            href="/busca"
            className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            Buscar peças
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Itens */}
          <div className="lg:col-span-2 space-y-3">
            {itens.map((item, idx) => (
              <div
                key={`${item.produtoId}-${idx}`}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4 hover:border-primary hover:shadow-sm transition-all"
              >
                <div className="w-16 h-16 bg-white border border-outline-variant rounded flex items-center justify-center overflow-hidden shrink-0">
                  {item.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.fotoUrl} alt="" className="w-14 h-14 object-contain" />
                  ) : (
                    <span className="material-symbols-outlined text-outline">settings_suggest</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface truncate">{item.descricao}</p>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">
                    <span className="font-mono text-code-md text-primary">{item.codigo}</span>
                    {item.fabricante ? ` · ${item.fabricante}` : ""}
                  </p>
                </div>

                {/* Quantidade */}
                <div className="flex items-center gap-1 border border-outline-variant rounded">
                  <button
                    onClick={() =>
                      updateCartItem(idx, { quantidade: Math.max(1, item.quantidade - 1) })
                    }
                    className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <span className="w-8 text-center font-mono text-code-md">{item.quantidade}</span>
                  <button
                    onClick={() => updateCartItem(idx, { quantidade: item.quantidade + 1 })}
                    className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>

                {/* Preço unitário manual */}
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-label-sm text-on-surface-variant">R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.precoUnitario || ""}
                      placeholder="0,00"
                      onChange={(e) =>
                        updateCartItem(idx, { precoUnitario: parseFloat(e.target.value) || 0 })
                      }
                      className="w-24 px-2 py-1.5 bg-surface-container-lowest border border-outline-variant rounded font-mono text-code-md text-right focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <span className="text-label-sm text-on-surface-variant">
                    Total: <span className="font-bold text-on-surface">{formatBRL(item.quantidade * item.precoUnitario)}</span>
                  </span>
                </div>

                <button
                  onClick={() => removeCartItem(idx)}
                  className="p-2 text-on-surface-variant hover:text-error transition-colors"
                  title="Remover"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <aside className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-4 sticky top-24 shadow-sm">
            <h2 className="text-headline-sm text-on-surface font-semibold">Resumo do Orçamento</h2>

            <div className="flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant" htmlFor="cliente">
                Cliente vinculado
              </label>
              <select
                id="cliente"
                value={clienteId ?? ""}
                onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="">— Sem cliente —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-outline-variant pt-3 space-y-2 text-body-md">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Subtotal</span>
                <span className="font-mono text-code-md font-bold">{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Validade</span>
                <span>{VALIDADE_DIAS} dias</span>
              </div>
            </div>

            <div className="border-t border-outline-variant pt-3 flex justify-between items-center">
              <span className="text-headline-sm text-on-surface">Total</span>
              <span className="text-headline-md font-bold font-mono text-primary">
                {formatBRL(subtotal)}
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded bg-primary text-on-primary hover:bg-primary-container transition-colors text-label-sm uppercase disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {salvando ? "Salvando…" : "Salvar Rascunho"}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Imprimir PDF
              </button>
            </div>
          </aside>
        </div>
      )}

      <OrcamentoBarraAcoes
        itens={itens}
        clienteNome={cliente?.nome}
        telefoneDestino={cliente?.whatsapp}
      />
    </div>
  );
}
