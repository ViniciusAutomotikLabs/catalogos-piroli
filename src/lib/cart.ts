"use client";

// Carrinho de orçamento client-side (localStorage). Persistência em DB ao salvar rascunho.

export type CartItem = {
  produtoId: number | null;
  codigo: string;
  descricao: string;
  fabricante?: string | null;
  fotoUrl?: string | null;
  quantidade: number;
  precoUnitario: number; // preço manual — estoque_loja só no MVP 2.0
};

const KEY = "orcamento-cart";
export const CART_EVENT = "cart-changed";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persist(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

export function addToCart(item: Omit<CartItem, "quantidade"> & { quantidade?: number }) {
  const items = getCart();
  const existing = items.find(
    (i) => i.produtoId !== null && i.produtoId === item.produtoId
  );
  if (existing) {
    existing.quantidade += item.quantidade ?? 1;
  } else {
    items.push({ ...item, quantidade: item.quantidade ?? 1 });
  }
  persist(items);
}

export function updateCartItem(index: number, patch: Partial<CartItem>) {
  const items = getCart();
  if (!items[index]) return;
  items[index] = { ...items[index], ...patch };
  persist(items);
}

export function removeCartItem(index: number) {
  const items = getCart();
  items.splice(index, 1);
  persist(items);
}

export function clearCart() {
  persist([]);
}

export function cartCount() {
  return getCart().reduce((acc, i) => acc + i.quantidade, 0);
}
