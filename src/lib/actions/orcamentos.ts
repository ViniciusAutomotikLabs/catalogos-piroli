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

  const itensSaneados = itens.map((i) => ({
    produtoId: i.produtoId,
    descricao: i.descricao,
    quantidade: Math.max(1, Math.trunc(Number(i.quantidade) || 1)),
    precoUnitario: Math.max(0, Number(i.precoUnitario) || 0),
  }));

  const supabase = await createClient();

  if (clienteId) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .eq("loja_id", contexto.lojaId)
      .maybeSingle();
    if (!cliente) return { ok: false, erro: "Cliente inválido para esta loja." };
  }

  // BE-09: transação atômica via RPC (fallback manual se migration pendente)
  const { data: rpcData, error: rpcError } = await supabase.rpc("salvar_orcamento", {
    p_loja_id: contexto.lojaId,
    p_cliente_id: clienteId ?? undefined,
    p_criado_por: contexto.user.id,
    p_itens: itensSaneados.map((i) => ({
      produto_id: i.produtoId,
      descricao: i.descricao,
      quantidade: i.quantidade,
      preco_unitario: i.precoUnitario,
    })),
  });

  if (!rpcError && rpcData?.[0]) {
    const row = rpcData[0];
    if (row.ok && row.orcamento_id) {
      if (clienteId) {
        revalidatePath("/clientes");
        revalidatePath(`/clientes/${clienteId}`);
      }
      revalidatePath("/orcamento");
      return { ok: true, orcamentoId: row.orcamento_id };
    }
    return { ok: false, erro: row.erro ?? "Falha ao salvar orçamento." };
  }

  // Fallback legado (dois inserts + rollback manual)
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
    await supabase.from("orcamentos").delete().eq("id", orcamento.id);
    return { ok: false, erro: itensErro.message };
  }

  if (clienteId) {
    await supabase
      .from("clientes")
      .update({ ultima_compra_em: new Date().toISOString() })
      .eq("id", clienteId)
      .eq("loja_id", contexto.lojaId);
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${clienteId}`);
  }

  revalidatePath("/orcamento");
  return { ok: true, orcamentoId: orcamento.id };
}
