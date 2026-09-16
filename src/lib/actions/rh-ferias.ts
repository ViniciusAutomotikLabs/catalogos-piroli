"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";
import { decifrar } from "@/lib/crypto";
import { calcularFerias } from "@/lib/rh/ferias";

export type EstadoRH = { erro?: string; ok?: boolean; mensagem?: string } | null;

const STATUS_FERIAS = ["agendada", "gozada", "paga"] as const;

function txt(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}
function int(fd: FormData, key: string, fallback: number): number {
  const n = Number(txt(fd, key));
  return Number.isFinite(n) ? n : fallback;
}

/** Carrega o contrato (com salário decifrado) garantindo a organização do usuário. */
async function carregarContrato(
  sb: SupabaseClient,
  contratoId: number,
  organizacaoId: number
): Promise<{ id: number; pessoa_id: number; salario: number } | null> {
  const { data } = await sb
    .from("rh_contratos")
    .select("id, pessoa_id, salario_base_cifrado")
    .eq("id", contratoId)
    .eq("organizacao_id", organizacaoId)
    .maybeSingle();
  if (!data) return null;
  let salario = 0;
  try {
    salario = Number(decifrar(data.salario_base_cifrado as string | null) ?? 0) || 0;
  } catch {
    salario = 0;
  }
  return { id: data.id as number, pessoa_id: data.pessoa_id as number, salario };
}

export async function agendarFerias(_estado: EstadoRH, formData: FormData): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };

  const contratoId = Number(formData.get("contrato_id"));
  if (!Number.isFinite(contratoId)) return { erro: "Contrato inválido." };

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const contrato = await carregarContrato(sb, contratoId, contexto.organizacaoId);
  if (!contrato) return { erro: "Contrato não encontrado." };

  const dias = Math.max(1, Math.min(30, int(formData, "dias_gozo", 30)));
  const abono = Math.max(0, Math.min(10, int(formData, "abono_pecuniario_dias", 0)));
  const status = (txt(formData, "status") ?? "agendada").toLowerCase();
  if (!STATUS_FERIAS.includes(status as (typeof STATUS_FERIAS)[number])) {
    return { erro: "Status inválido." };
  }

  const calc = calcularFerias(contrato.salario, dias, abono);

  const { error } = await sb.from("rh_ferias").insert({
    contrato_id: contratoId,
    aquisitivo_inicio: txt(formData, "aquisitivo_inicio"),
    aquisitivo_fim: txt(formData, "aquisitivo_fim"),
    concessivo_ate: txt(formData, "concessivo_ate"),
    dias_gozo: dias,
    data_inicio_gozo: txt(formData, "data_inicio_gozo"),
    abono_pecuniario_dias: abono,
    valor_calculado: calc.total,
    status,
    observacao: txt(formData, "observacao"),
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/rh/ferias");
  revalidatePath(`/rh/funcionarios/${contrato.pessoa_id}`);
  return { ok: true, mensagem: `Férias agendadas. Valor estimado: R$ ${calc.total.toFixed(2)}` };
}

export async function alterarStatusFerias(id: number, status: string): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  if (!STATUS_FERIAS.includes(status as (typeof STATUS_FERIAS)[number])) {
    return { erro: "Status inválido." };
  }
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const { error } = await sb.from("rh_ferias").update({ status }).eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath("/rh/ferias");
  return { ok: true };
}

export async function removerFerias(id: number): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const { error } = await sb.from("rh_ferias").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath("/rh/ferias");
  return { ok: true };
}
