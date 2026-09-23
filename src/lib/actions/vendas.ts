"use server";

import { revalidatePath } from "next/cache";
import { createErpClient } from "@/lib/supabase/erp";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { aplicarMovimentoEspelho } from "@/lib/actions/estoque";
import { hojeSp } from "@/lib/vendas-dia";

export type EstadoVenda = { ok?: boolean; erro?: string; vendaId?: number };

type ItemInput = {
  produtoId?: number | null;
  codigo?: string | null;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
};

export async function criarVendaDeOrcamento(
  orcamentoId: number | null,
  itens: ItemInput[],
  opts?: {
    pessoaId?: number | null;
    clienteId?: number | null;
    oficinaPessoaId?: number | null;
    mecanicoPessoaId?: number | null;
    comissaoOficinaPct?: number;
    comissaoMecanicoPct?: number;
    observacao?: string | null;
  }
): Promise<EstadoVenda> {
  await requireModulo("vendas");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId || !contexto.lojaId) {
    return { erro: "Organização/loja não configurada." };
  }
  if (!itens.length) return { erro: "Informe ao menos um item." };

  const sb = await createErpClient();
  const itensSaneados = itens.map((i) => ({
    produtoId: i.produtoId ?? null,
    codigo: i.codigo?.trim() || null,
    descricao: i.descricao.trim(),
    quantidade: Math.max(0.001, Number(i.quantidade) || 1),
    precoUnitario: Math.max(0, Number(i.precoUnitario) || 0),
  }));
  const semCodigo = itensSaneados.filter((i) => !i.codigo);
  if (semCodigo.length > 0) {
    return {
      erro: `${semCodigo.length} item(ns) sem código SS/espelho — adicione pela busca de estoque ou peça com código para reservar saldo.`,
    };
  }

  let clienteId = opts?.clienteId ?? null;
  if (clienteId != null) {
    const { data: cli } = await sb
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .eq("loja_id", contexto.lojaId)
      .maybeSingle();
    if (!cli) {
      return { erro: "Cliente inválido para esta loja." };
    }
  }

  const codigos = [
    ...new Set(itensSaneados.map((i) => i.codigo!).filter(Boolean)),
  ];
  const { data: saldos } = await sb
    .from("estoque_saldos")
    .select("codigo")
    .eq("organizacao_id", contexto.organizacaoId)
    .in("codigo", codigos);
  const noEspelho = new Set((saldos ?? []).map((s) => String(s.codigo)));
  const faltando = codigos.filter((c) => !noEspelho.has(c));
  if (faltando.length > 0) {
    return {
      erro: `Código(s) sem saldo no espelho: ${faltando.slice(0, 5).join(", ")}${faltando.length > 5 ? "…" : ""}. Inclua pela busca de estoque.`,
    };
  }

  const total = itensSaneados.reduce(
    (acc, i) => acc + i.quantidade * i.precoUnitario,
    0
  );

  const { data: venda, error } = await sb
    .from("vendas")
    .insert({
      organizacao_id: contexto.organizacaoId,
      loja_id: contexto.lojaId,
      orcamento_id: orcamentoId,
      pessoa_id: opts?.pessoaId ?? null,
      cliente_id: clienteId,
      status: "aberta",
      entrega_status: "pendente",
      oficina_pessoa_id: opts?.oficinaPessoaId ?? null,
      mecanico_pessoa_id: opts?.mecanicoPessoaId ?? null,
      comissao_oficina_pct: opts?.comissaoOficinaPct ?? 0,
      comissao_mecanico_pct: opts?.comissaoMecanicoPct ?? 0,
      total,
      observacao: opts?.observacao ?? null,
      criado_por: contexto.user.id,
    })
    .select("id")
    .single();

  if (error || !venda) {
    return { erro: "Falha ao criar venda." };
  }

  const { error: itensErro } = await sb.from("venda_itens").insert(
    itensSaneados.map((i) => ({
      venda_id: venda.id,
      produto_id: i.produtoId,
      codigo: i.codigo,
      descricao: i.descricao,
      quantidade: i.quantidade,
      preco_unitario: i.precoUnitario,
    }))
  );
  if (itensErro) {
    await sb
      .from("vendas")
      .delete()
      .eq("id", venda.id)
      .eq("organizacao_id", contexto.organizacaoId);
    return { erro: "Falha ao gravar itens da venda." };
  }

  for (const i of itensSaneados) {
    const mov = await aplicarMovimentoEspelho({
      codigo: i.codigo!,
      tipo: "reserva",
      quantidade: i.quantidade,
      produtoId: i.produtoId,
      descricao: i.descricao,
      preco: i.precoUnitario,
      referenciaTipo: "venda",
      referenciaId: venda.id,
      observacao: "Reserva na abertura da venda",
      exigirSaldoExistente: true,
    });
    if (!mov.ok) {
      // rollback best-effort
      for (const j of itensSaneados) {
        if (!j.codigo) continue;
        await aplicarMovimentoEspelho({
          codigo: j.codigo,
          tipo: "cancelamento",
          quantidade: j.quantidade,
          produtoId: j.produtoId,
          descricao: j.descricao,
          preco: j.precoUnitario,
          referenciaTipo: "venda",
          referenciaId: venda.id,
          observacao: "Rollback reserva — falha na criação",
          exigirSaldoExistente: true,
        });
      }
      await sb.from("venda_itens").delete().eq("venda_id", venda.id);
      await sb
        .from("vendas")
        .delete()
        .eq("id", venda.id)
        .eq("organizacao_id", contexto.organizacaoId);
      return {
        erro: mov.erro ?? "Falha ao reservar estoque. Venda não foi criada.",
      };
    }
  }

  revalidatePath("/vendas");
  revalidatePath("/estoque");
  return { ok: true, vendaId: venda.id };
}

export async function fecharVenda(vendaId: number): Promise<EstadoVenda> {
  await requireModulo("vendas");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId || !contexto.lojaId) {
    return { erro: "Organização/loja não configurada." };
  }

  const sb = await createErpClient();
  const { data: venda } = await sb
    .from("vendas")
    .select("id, status, total, organizacao_id")
    .eq("id", vendaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("loja_id", contexto.lojaId)
    .maybeSingle();

  if (!venda) return { erro: "Venda não encontrada." };
  if (venda.status === "fechada") return { ok: true, vendaId };
  if (venda.status === "cancelada") return { erro: "Venda cancelada." };

  const { data: fechada, error } = await sb
    .from("vendas")
    .update({
      status: "fechada",
      fechada_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", vendaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("status", "aberta")
    .select("id")
    .maybeSingle();

  if (error) return { erro: "Falha ao fechar venda." };
  if (!fechada) {
    // Outra request já fechou
    return { ok: true, vendaId };
  }

  const { data: tituloExistente } = await sb
    .from("financeiro_titulos")
    .select("id")
    .eq("venda_id", vendaId)
    .eq("tipo", "receber")
    .neq("status", "cancelado")
    .limit(1)
    .maybeSingle();

  if (!tituloExistente) {
    const { error: titErro } = await sb.from("financeiro_titulos").insert({
      organizacao_id: contexto.organizacaoId,
      loja_id: contexto.lojaId,
      venda_id: vendaId,
      tipo: "receber",
      descricao: `Venda #${vendaId}`,
      valor: Number(venda.total) || 0,
      status: "aberto",
      vencimento: hojeSp(),
      criado_por: contexto.user.id,
    });
    if (titErro) {
      // Venda já fechada; não reabrir — título pode ser gerado manualmente
      return { erro: "Venda fechada, mas falhou ao gerar título no caixa." };
    }
  }

  revalidatePath("/vendas");
  revalidatePath(`/vendas/${vendaId}`);
  revalidatePath("/caixa");
  return { ok: true, vendaId };
}

export async function cancelarVenda(vendaId: number): Promise<EstadoVenda> {
  await requireModulo("vendas");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId || !contexto.lojaId) {
    return { erro: "Organização/loja não configurada." };
  }

  const sb = await createErpClient();
  const { data: venda } = await sb
    .from("vendas")
    .select("id, status, entrega_status")
    .eq("id", vendaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("loja_id", contexto.lojaId)
    .maybeSingle();
  if (!venda) return { erro: "Venda não encontrada." };
  if (venda.status === "cancelada") return { ok: true, vendaId };

  if (
    venda.entrega_status === "entregue" ||
    venda.entrega_status === "parcial"
  ) {
    return {
      erro:
        "Não é possível cancelar após entrega (parcial ou total). Estorne pelo estoque se necessário.",
    };
  }

  const { data: itens } = await sb
    .from("venda_itens")
    .select(
      "codigo, quantidade, quantidade_entregue, produto_id, descricao, preco_unitario"
    )
    .eq("venda_id", vendaId);

  const jaEntregue = (itens ?? []).some(
    (i) => Number(i.quantidade_entregue) > 0
  );
  if (jaEntregue) {
    return {
      erro:
        "Não é possível cancelar: há itens já entregues. Estorne pelo estoque se necessário.",
    };
  }

  for (const i of itens ?? []) {
    if (!i.codigo) continue;
    const pendente = Number(i.quantidade) - Number(i.quantidade_entregue);
    if (pendente > 0) {
      const mov = await aplicarMovimentoEspelho({
        codigo: i.codigo,
        tipo: "cancelamento",
        quantidade: pendente,
        produtoId: i.produto_id,
        descricao: i.descricao,
        preco: Number(i.preco_unitario),
        referenciaTipo: "venda",
        referenciaId: vendaId,
        observacao: "Cancelamento de reserva",
        exigirSaldoExistente: true,
      });
      if (!mov.ok) {
        return {
          erro: mov.erro ?? "Falha ao liberar reserva no estoque.",
        };
      }
    }
  }

  const { error } = await sb
    .from("vendas")
    .update({
      status: "cancelada",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", vendaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .neq("status", "cancelada");

  if (error) return { erro: "Falha ao cancelar venda." };

  await sb
    .from("financeiro_titulos")
    .update({ status: "cancelado" })
    .eq("venda_id", vendaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("status", "aberto");

  revalidatePath("/vendas");
  revalidatePath(`/vendas/${vendaId}`);
  revalidatePath("/caixa");
  revalidatePath("/estoque");
  return { ok: true, vendaId };
}

export async function confirmarEntrega(
  vendaId: number,
  itemIds?: number[]
): Promise<EstadoVenda> {
  await requireModulo("vendas");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId || !contexto.lojaId) {
    return { erro: "Organização/loja não configurada." };
  }

  const sb = await createErpClient();
  const { data: venda } = await sb
    .from("vendas")
    .select("id, status, entrega_status")
    .eq("id", vendaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("loja_id", contexto.lojaId)
    .maybeSingle();

  if (!venda) return { erro: "Venda não encontrada." };
  if (venda.status === "cancelada") return { erro: "Venda cancelada." };

  let q = sb
    .from("venda_itens")
    .select(
      "id, codigo, quantidade, quantidade_entregue, produto_id, descricao, preco_unitario"
    )
    .eq("venda_id", vendaId);
  if (itemIds?.length) q = q.in("id", itemIds);

  const { data: itens } = await q;
  if (!itens?.length) return { erro: "Nenhum item para entregar." };

  for (const i of itens) {
    const restante =
      Number(i.quantidade) - Number(i.quantidade_entregue || 0);
    if (restante <= 0) continue;

    // Atualiza entregue primeiro com guarda — reduz double-baixa em corrida
    const { data: atualizado } = await sb
      .from("venda_itens")
      .update({ quantidade_entregue: Number(i.quantidade) })
      .eq("id", i.id)
      .eq("venda_id", vendaId)
      .lt("quantidade_entregue", Number(i.quantidade))
      .select("id")
      .maybeSingle();

    if (!atualizado) continue;

    if (i.codigo) {
      const mov = await aplicarMovimentoEspelho({
        codigo: i.codigo,
        tipo: "entrega",
        quantidade: restante,
        produtoId: i.produto_id,
        descricao: i.descricao,
        preco: Number(i.preco_unitario),
        referenciaTipo: "venda",
        referenciaId: vendaId,
        observacao: "Baixa definitiva na entrega",
        exigirSaldoExistente: true,
      });
      if (!mov.ok) {
        // Reverte marcação do item
        await sb
          .from("venda_itens")
          .update({ quantidade_entregue: Number(i.quantidade_entregue) || 0 })
          .eq("id", i.id)
          .eq("venda_id", vendaId);
        return {
          erro: mov.erro ?? "Falha na baixa de estoque na entrega.",
        };
      }
    }
  }

  const { data: todos } = await sb
    .from("venda_itens")
    .select("quantidade, quantidade_entregue")
    .eq("venda_id", vendaId);

  const total = (todos ?? []).reduce((a, i) => a + Number(i.quantidade), 0);
  const entregue = (todos ?? []).reduce(
    (a, i) => a + Number(i.quantidade_entregue),
    0
  );
  const entregaStatus =
    entregue <= 0 ? "pendente" : entregue >= total ? "entregue" : "parcial";

  await sb
    .from("vendas")
    .update({
      entrega_status: entregaStatus,
      entregue_em:
        entregaStatus === "entregue" ? new Date().toISOString() : null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", vendaId)
    .eq("organizacao_id", contexto.organizacaoId);

  if (venda.status !== "fechada") {
    await fecharVenda(vendaId);
  }

  revalidatePath("/vendas");
  revalidatePath(`/vendas/${vendaId}`);
  revalidatePath("/entregas");
  revalidatePath("/estoque");
  return { ok: true, vendaId };
}

export async function excluirVendaRascunho(
  vendaId: number
): Promise<EstadoVenda> {
  await requireModulo("vendas");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId || !contexto.lojaId) {
    return { erro: "Organização/loja não configurada." };
  }

  const sb = await createErpClient();
  const { data: venda } = await sb
    .from("vendas")
    .select("id, status")
    .eq("id", vendaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("loja_id", contexto.lojaId)
    .maybeSingle();

  if (!venda) return { erro: "Venda não encontrada." };
  if (venda.status !== "rascunho") {
    return {
      erro: "Só é possível excluir vendas em rascunho. Cancele as demais.",
    };
  }

  const { error } = await sb
    .from("vendas")
    .delete()
    .eq("id", vendaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("status", "rascunho");
  if (error) return { erro: "Falha ao excluir rascunho." };

  revalidatePath("/vendas");
  return { ok: true };
}
