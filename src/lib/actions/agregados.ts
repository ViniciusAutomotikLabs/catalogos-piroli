"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarAgregado(input: {
  produtoPrincipalId: number;
  produtoRelacionadoId: number;
  obrigatorio?: boolean;
  quantidadeSugerida?: number;
  observacao?: string;
}): Promise<{ ok: boolean; erro?: string }> {
  if (input.produtoPrincipalId === input.produtoRelacionadoId) {
    return { ok: false, erro: "A peça principal e o agregado não podem ser o mesmo produto." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("produto_relacoes").insert({
    produto_principal_id: input.produtoPrincipalId,
    produto_relacionado_id: input.produtoRelacionadoId,
    tipo: "agregado",
    obrigatorio: input.obrigatorio ?? false,
    quantidade_sugerida: Math.max(1, input.quantidadeSugerida ?? 1),
    observacao: input.observacao?.trim() || null,
    fonte: "manual",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, erro: "Este agregado já está cadastrado para esta peça." };
    }
    return { ok: false, erro: error.message };
  }

  revalidatePath("/agregados");
  revalidatePath("/busca");
  revalidatePath(`/produtos/${input.produtoPrincipalId}`);
  return { ok: true };
}

export async function removerAgregado(id: number, produtoPrincipalId: number): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("produto_relacoes").delete().eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/agregados");
  revalidatePath("/busca");
  revalidatePath(`/produtos/${produtoPrincipalId}`);
  return { ok: true };
}

export async function buscarProdutosParaAgregado(termo: string) {
  const q = termo.replace(/[,()%]/g, " ").trim();
  if (!q || q.length < 2) return [];

  const supabase = await createClient();
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from("produtos")
    .select(
      "id, codigo_principal, codigo_produto_interno, titulo_normalizado, descricao, foto_url, origem_catalogo"
    )
    .or(
      `codigo_principal.ilike.${pattern},codigo_produto_interno.ilike.${pattern},titulo_normalizado.ilike.${pattern},descricao.ilike.${pattern}`
    )
    .limit(12);

  return data ?? [];
}
