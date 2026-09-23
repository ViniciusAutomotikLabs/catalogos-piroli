"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type SugestaoBusca = {
  id: string;
  termo: string;
  codigo: string;
  titulo: string;
  origem: "espelho" | "catalogo";
  preco: number | null;
  produtoId: number | null;
  fotoUrl: string | null;
};

type Props = {
  id?: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  /** Classes do input */
  inputClassName: string;
  /** Ícone à esquerda (ex.: search) — se true, reserva pl-10/pl-12 no layout pai */
  showKbdHint?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
  /** Se true, clicar numa sugestão com produtoId vai direto à ficha */
  preferProdutoLink?: boolean;
};

function formatPreco(v: number | null) {
  if (v == null || Number.isNaN(v)) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CampoBuscaAutocomplete({
  id,
  name = "q",
  defaultValue = "",
  placeholder,
  inputClassName,
  showKbdHint = false,
  autoFocus = false,
  "aria-label": ariaLabel,
  preferProdutoLink = true,
}: Props) {
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<SugestaoBusca[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const fechar = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [fechar]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      fechar();
      return;
    }

    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/busca/sugestoes?q=${encodeURIComponent(q)}`,
          { signal: ac.signal }
        );
        if (!res.ok) throw new Error("fail");
        const data = (await res.json()) as { items: SugestaoBusca[] };
        setItems(data.items ?? []);
        setOpen((data.items?.length ?? 0) > 0);
        setActive(-1);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setItems([]);
        fechar();
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(t);
      abortRef.current?.abort();
    };
  }, [value, fechar]);

  const irPara = useCallback(
    (s: SugestaoBusca) => {
      fechar();
      if (preferProdutoLink && s.produtoId) {
        router.push(`/produtos/${s.produtoId}`);
        return;
      }
      // Hit do espelho SS sem produto no catálogo → ficha de estoque
      if (s.origem === "espelho" && s.codigo) {
        router.push(`/estoque/${encodeURIComponent(s.codigo)}`);
        return;
      }
      const termo = s.codigo || s.termo;
      setValue(termo);
      router.push(`/busca?q=${encodeURIComponent(termo)}`);
    },
    [fechar, preferProdutoLink, router]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) {
      if (e.key === "Escape") fechar();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      irPara(items[active]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        ref={inputRef}
        id={id}
        type="text"
        name={name}
        value={value}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-busy={loading}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        role="combobox"
        placeholder={placeholder}
        className={inputClassName}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          if (items.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {showKbdHint && (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center rounded border border-outline-variant bg-surface-container px-1.5 py-0.5 font-mono text-[11px] leading-none text-on-surface-variant sm:inline-flex">
          /
        </kbd>
      )}
      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
        >
          {items.map((s, i) => {
            const preco = formatPreco(s.preco);
            return (
              <li key={s.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  className={
                    i === active
                      ? "flex w-full items-start gap-3 bg-primary-container px-3 py-2 text-left"
                      : "flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-surface-container-high"
                  }
                  onMouseEnter={() => setActive(i)}
                  onClick={() => irPara(s)}
                >
                  <span className="mt-0.5 material-symbols-outlined text-[18px] text-outline">
                    {s.origem === "espelho" ? "inventory_2" : "menu_book"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-body-md font-semibold text-on-surface">
                      {s.codigo || s.termo}
                    </span>
                    <span className="block truncate text-label-sm text-on-surface-variant">
                      {s.titulo}
                    </span>
                  </span>
                  {preco && (
                    <span className="shrink-0 text-label-sm font-medium text-on-surface">
                      {preco}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
