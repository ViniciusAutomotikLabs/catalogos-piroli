"use server";

import { revalidatePath } from "next/cache";
import { createErpClient } from "@/lib/supabase/erp";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { boundsDiaSp, hojeSp } from "@/lib/vendas-dia";

export async function marcarTituloPago(
  tituloId: number
): Promise<{ ok: boolean; erro?: string }> {
  await requireModulo("financeiro");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) {
    return { ok: false, erro: "Organização não configurada." };
  }

  const sb = await createErpClient();
  const { error } = await sb
    .from("financeiro_titulos")
    .update({
      status: "pago",
      pago_em: new Date().toISOString(),
    })
    .eq("id", tituloId)
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("status", "aberto");

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/caixa");
  return { ok: true };
}

export async function listarCaixaDoDia(dataIso?: string): Promise<{
  pagos: Array<{
    id: number;
    descricao: string;
    valor: number;
    pago_em: string | null;
    venda_id: number | null;
  }>;
  abertos: Array<{
    id: number;
    descricao: string;
    valor: number;
    vencimento: string | null;
    venda_id: number | null;
  }>;
  totalPago: number;
  totalAberto: number;
}> {
  await requireModulo("financeiro");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) {
    return { pagos: [], abertos: [], totalPago: 0, totalAberto: 0 };
  }

  const diaRaw = (dataIso ?? hojeSp()).trim().slice(0, 10);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaRaw) ? diaRaw : hojeSp();
  const { inicio, fim } = boundsDiaSp(dia);

  const sb = await createErpClient();

  const { data: pagos } = await sb
    .from("financeiro_titulos")
    .select("id, descricao, valor, pago_em, venda_id")
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("tipo", "receber")
    .eq("status", "pago")
    .gte("pago_em", inicio)
    .lt("pago_em", fim)
    .order("pago_em", { ascending: false });

  const { data: abertos } = await sb
    .from("financeiro_titulos")
    .select("id, descricao, valor, vencimento, venda_id")
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("tipo", "receber")
    .eq("status", "aberto")
    .order("criado_em", { ascending: false });

  const listaPagos = (pagos ?? []).map((t) => ({
    id: t.id,
    descricao: t.descricao,
    valor: Number(t.valor) || 0,
    pago_em: t.pago_em,
    venda_id: t.venda_id,
  }));
  const listaAbertos = (abertos ?? []).map((t) => ({
    id: t.id,
    descricao: t.descricao,
    valor: Number(t.valor) || 0,
    vencimento: t.vencimento,
    venda_id: t.venda_id,
  }));

  return {
    pagos: listaPagos,
    abertos: listaAbertos,
    totalPago: listaPagos.reduce((a, t) => a + t.valor, 0),
    totalAberto: listaAbertos.reduce((a, t) => a + t.valor, 0),
  };
}
