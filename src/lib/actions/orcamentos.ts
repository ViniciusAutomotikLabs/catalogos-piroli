"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";

type ItemOrcamento = {
  produtoId: number | null;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
};

export async function salvarOrcamento(
  clienteId: number | null,
  itens: ItemOrcamento[]
): Promise<{ ok: boolean; erro?: string; orcamentoId?: number }> {
  const contexto = await getContextoLoja();
  if (!contexto?.lojaId) return { ok: false, erro: "Conta sem loja vinculada." };
  if (itens.length === 0) return { ok: false, erro: "O orçamento está vazio." };

  // Saneia os itens: quantidade mínima 1, preço nunca negativo.
  const itensSaneados = itens.map((i) => ({
    produtoId: i.produtoId,
    descricao: i.descricao,
    quantidade: Math.max(1, Math.trunc(Number(i.quantidade) || 1)),
    precoUnitario: Math.max(0, Number(i.precoUnitario) || 0),
  }));

  const supabase = await createClient();

  // Garante que o cliente informado pertence à loja do usuário antes de vincular.
  if (clienteId) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .eq("loja_id", contexto.lojaId)
      .maybeSingle();
    if (!cliente) return { ok: false, erro: "Cliente inválido para esta loja." };
  }

  const agora = new Date().toISOString();
  const { data: orcamento, error } = await supabase
    .from("orcamentos")
    .insert({
      loja_id: contexto.lojaId,
      cliente_id: clienteId,
      status: "rascunho",
      criado_por: contexto.user.id,
    })
    .select("id")
    .single();

  if (error || !orcamento) {
    return { ok: false, erro: error?.message ?? "Falha ao criar orçamento." };
  }

  const { error: itensErro } = await supabase.from("orcamento_itens").insert(
    itensSaneados.map((i) => ({
      orcamento_id: orcamento.id,
      produto_id: i.produtoId,
      descricao_avulsa: i.produtoId ? null : i.descricao,
      quantidade: i.quantidade,
      preco_unitario: i.precoUnitario,
    }))
  );

  if (itensErro) {
    // Rollback manual: sem transação (PostgREST), removemos o cabeçalho órfão.
    await supabase.from("orcamentos").delete().eq("id", orcamento.id);
    return { ok: false, erro: itensErro.message };
  }

  if (clienteId) {
    await supabase
      .from("clientes")
      .update({ ultima_compra_em: agora })
      .eq("id", clienteId)
      .eq("loja_id", contexto.lojaId);
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${clienteId}`);
  }

  revalidatePath("/orcamento");
  return { ok: true, orcamentoId: orcamento.id };
}
