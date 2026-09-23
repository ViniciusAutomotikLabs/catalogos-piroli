import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErpClient } from "@/lib/supabase/erp";
import { getContextoLoja } from "@/lib/loja";
import { codigoExibicao, tituloExibicao } from "@/lib/produto-campos";

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

function sanitize(q: string) {
  return q.replace(/[,()%]/g, " ").trim().slice(0, 80);
}

function escapeIlike(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = sanitize(url.searchParams.get("q") ?? "");
  if (q.length < 2) {
    return NextResponse.json({ items: [] as SugestaoBusca[] });
  }

  const contexto = await getContextoLoja();
  if (!contexto?.lojaId) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const pattern = `%${escapeIlike(q)}%`;
  const prefix = `${escapeIlike(q)}%`;
  const items: SugestaoBusca[] = [];
  const seen = new Set<string>();

  const push = (s: SugestaoBusca) => {
    const key = s.codigo.toLowerCase() || s.termo.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push(s);
  };

  try {
    if (contexto.organizacaoId) {
      const erp = await createErpClient();
      const { data: espelho } = await erp
        .from("estoque_saldos")
        .select("codigo, descricao, preco, produto_id")
        .eq("organizacao_id", contexto.organizacaoId)
        .or(`codigo.ilike."${prefix}",descricao.ilike."${pattern}"`)
        .order("codigo")
        .limit(8);

      for (const row of espelho ?? []) {
        const codigo = String(row.codigo ?? "").trim();
        if (!codigo) continue;
        push({
          id: `e-${codigo}`,
          termo: codigo,
          codigo,
          titulo: String(row.descricao ?? codigo),
          origem: "espelho",
          preco: row.preco != null ? Number(row.preco) : null,
          produtoId: row.produto_id ?? null,
          fotoUrl: null,
        });
      }
    }

    if (items.length < 8) {
      const supabase = await createClient();
      const { data: rpc } = await supabase.rpc("buscar_produtos", {
        p_termo: q,
        p_catalogo: undefined,
        p_com_foto: false,
        p_pagina: 1,
        p_limite: 8,
      });

      for (const r of (rpc ?? []) as Array<{
        id: number;
        codigo_principal?: string | null;
        codigo_produto_interno: string;
        titulo_normalizado?: string | null;
        descricao?: string | null;
        foto_url?: string | null;
      }>) {
        if (items.length >= 10) break;
        const codigo = codigoExibicao(r);
        const titulo = tituloExibicao(r);
        push({
          id: `c-${r.id}`,
          termo: codigo || titulo,
          codigo,
          titulo,
          origem: "catalogo",
          preco: null,
          produtoId: r.id,
          fotoUrl: r.foto_url ?? null,
        });
      }
    }
  } catch {
    // Fallback silencioso — autocomplete não deve quebrar a busca
  }

  return NextResponse.json({ items: items.slice(0, 10) });
}
