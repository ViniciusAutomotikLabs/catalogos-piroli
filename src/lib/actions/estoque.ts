"use server";

import { revalidatePath } from "next/cache";
import { createErpClient } from "@/lib/supabase/erp";
import { getContextoLoja } from "@/lib/loja";

type TipoMovimento =
  | "entrada"
  | "saida"
  | "reserva"
  | "entrega"
  | "ajuste"
  | "cancelamento"
  | "sync";

/**
 * Aplica movimento no espelho: atualiza saldo + grava histórico.
 * reserva aumenta `reservado`; entrega/saida baixa quantidade (e libera reservado se vier de venda).
 */
export async function aplicarMovimentoEspelho(opts: {
  codigo: string;
  tipo: TipoMovimento;
  quantidade: number;
  produtoId?: number | null;
  descricao?: string | null;
  unidadeId?: number | null;
  preco?: number | null;
  referenciaTipo?: string | null;
  referenciaId?: number | null;
  observacao?: string | null;
  /** Se true, não cria SKU fantasma (reserva/cancelamento/entrega exigem linha). */
  exigirSaldoExistente?: boolean;
}): Promise<{ ok: boolean; erro?: string }> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) {
    return { ok: false, erro: "Organização não configurada." };
  }

  const codigo = opts.codigo.trim();
  const qtd = Math.abs(Number(opts.quantidade) || 0);
  if (!codigo || qtd <= 0) return { ok: false, erro: "Movimento inválido." };

  const sb = await createErpClient();
  const orgId = contexto.organizacaoId;
  const unidadeId = opts.unidadeId ?? null;

  let q = sb
    .from("estoque_saldos")
    .select("id, quantidade, reservado, preco, descricao, produto_id")
    .eq("organizacao_id", orgId)
    .eq("codigo", codigo);
  q = unidadeId == null ? q.is("unidade_id", null) : q.eq("unidade_id", unidadeId);

  const { data: existente } = await q.maybeSingle();

  if (
    !existente &&
    (opts.exigirSaldoExistente ||
      opts.tipo === "reserva" ||
      opts.tipo === "entrega" ||
      opts.tipo === "cancelamento")
  ) {
    return {
      ok: false,
      erro: `Código ${codigo} não existe no espelho de estoque.`,
    };
  }

  let quantidade = Number(existente?.quantidade) || 0;
  let reservado = Number(existente?.reservado) || 0;

  switch (opts.tipo) {
    case "entrada":
    case "sync":
    case "ajuste":
      quantidade = opts.tipo === "ajuste" ? qtd : quantidade + qtd;
      break;
    case "saida":
    case "entrega":
      quantidade = Math.max(0, quantidade - qtd);
      reservado = Math.max(0, reservado - qtd);
      break;
    case "reserva":
      reservado = reservado + qtd;
      break;
    case "cancelamento":
      reservado = Math.max(0, reservado - qtd);
      break;
  }

  const preco =
    opts.preco != null
      ? Number(opts.preco)
      : Number(existente?.preco) || 0;
  const descricao = opts.descricao ?? existente?.descricao ?? null;
  const produtoId = opts.produtoId ?? existente?.produto_id ?? null;

  if (existente?.id) {
    const { error } = await sb
      .from("estoque_saldos")
      .update({
        quantidade,
        reservado,
        preco,
        descricao,
        produto_id: produtoId,
        atualizado_em: new Date().toISOString(),
        atualizado_por_sync: opts.tipo === "sync",
      })
      .eq("id", existente.id)
      .eq("organizacao_id", orgId);
    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await sb.from("estoque_saldos").insert({
      organizacao_id: orgId,
      unidade_id: unidadeId,
      codigo,
      produto_id: produtoId,
      descricao,
      quantidade,
      reservado,
      preco,
      atualizado_por_sync: opts.tipo === "sync",
    });
    if (error) return { ok: false, erro: error.message };
  }

  await sb.from("estoque_movimentos").insert({
    organizacao_id: orgId,
    unidade_id: unidadeId,
    codigo,
    produto_id: produtoId,
    tipo: opts.tipo,
    quantidade: opts.tipo === "saida" || opts.tipo === "entrega" ? -qtd : qtd,
    saldo_apos: quantidade,
    referencia_tipo: opts.referenciaTipo ?? null,
    referencia_id: opts.referenciaId ?? null,
    observacao: opts.observacao ?? null,
    criado_por: contexto.user.id,
  });

  revalidatePath("/estoque");
  return { ok: true };
}

export async function ajustarSaldoManual(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const codigo = String(formData.get("codigo") ?? "").trim();
  const quantidade = Number(formData.get("quantidade") ?? 0);
  const preco = Number(formData.get("preco") ?? 0);
  const descricao = String(formData.get("descricao") ?? "").trim() || null;

  if (!codigo) return { ok: false, erro: "Informe o código." };

  return aplicarMovimentoEspelho({
    codigo,
    tipo: "ajuste",
    quantidade,
    preco,
    descricao,
    observacao: "Ajuste manual",
  });
}
