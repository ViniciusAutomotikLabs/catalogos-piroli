"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";
import { decifrar } from "@/lib/crypto";
import { calcularRescisao, type TipoRescisao } from "@/lib/rh/rescisao";

export type EstadoRH = { erro?: string; ok?: boolean; mensagem?: string } | null;

const TIPOS: TipoRescisao[] = [
  "sem_justa_causa",
  "pedido_demissao",
  "justa_causa",
  "acordo",
  "fim_contrato",
];
const AVISOS = ["trabalhado", "indenizado", "dispensado"] as const;

function txt(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}
function numf(fd: FormData, key: string, fallback = 0): number {
  const n = Number(txt(fd, key));
  return Number.isFinite(n) ? n : fallback;
}

const CHECKLIST_PADRAO = [
  { item: "Exame demissional (ASO)", ok: false },
  { item: "Devolução de equipamentos/uniforme", ok: false },
  { item: "Entrega de documentos (TRCT, guias)", ok: false },
  { item: "Baixa na CTPS", ok: false },
  { item: "Homologação (se aplicável)", ok: false },
];

export async function salvarRescisao(_estado: EstadoRH, formData: FormData): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };

  const contratoId = Number(formData.get("contrato_id"));
  const pessoaId = Number(formData.get("pessoa_id"));
  const tipo = (txt(formData, "tipo") ?? "") as TipoRescisao;
  const dataDesligamento = txt(formData, "data_desligamento");
  if (!Number.isFinite(contratoId)) return { erro: "Contrato inválido." };
  if (!TIPOS.includes(tipo)) return { erro: "Tipo de rescisão inválido." };
  if (!dataDesligamento) return { erro: "Data de desligamento é obrigatória." };

  const avisoTipoRaw = txt(formData, "aviso_tipo");
  const aviso_tipo =
    avisoTipoRaw && AVISOS.includes(avisoTipoRaw as (typeof AVISOS)[number])
      ? (avisoTipoRaw as (typeof AVISOS)[number])
      : null;

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { data: contrato } = await sb
    .from("rh_contratos")
    .select("id, pessoa_id, salario_base_cifrado")
    .eq("id", contratoId)
    .eq("organizacao_id", contexto.organizacaoId)
    .maybeSingle();
  if (!contrato) return { erro: "Contrato não encontrado." };

  let salario = 0;
  try {
    salario = Number(decifrar(contrato.salario_base_cifrado as string | null) ?? 0) || 0;
  } catch {
    salario = 0;
  }

  const resultado = calcularRescisao({
    salario,
    diasTrabalhadosMes: numf(formData, "dias_trabalhados_mes", 30),
    mesesProporcionais: numf(formData, "meses_proporcionais", 0),
    temFeriasVencidas: formData.get("tem_ferias_vencidas") === "on" || formData.get("tem_ferias_vencidas") === "true",
    tipo,
    avisoTipo: aviso_tipo ?? undefined,
    saldoFgts: numf(formData, "saldo_fgts", 0),
  });

  const registro = {
    contrato_id: contratoId,
    tipo,
    motivo: txt(formData, "motivo"),
    aviso_tipo,
    data_aviso: txt(formData, "data_aviso"),
    data_desligamento: dataDesligamento,
    verbas: resultado.verbas,
    checklist: CHECKLIST_PADRAO,
  };

  // Upsert (1 rescisão por contrato).
  const { data: existente } = await sb
    .from("rh_rescisoes")
    .select("id")
    .eq("contrato_id", contratoId)
    .maybeSingle();

  if (existente) {
    const { error } = await sb.from("rh_rescisoes").update(registro).eq("id", existente.id);
    if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  } else {
    const { error } = await sb.from("rh_rescisoes").insert(registro);
    if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  }

  // Atualiza o contrato: desligado.
  await sb
    .from("rh_contratos")
    .update({ status: "desligado", desligamento_em: dataDesligamento })
    .eq("id", contratoId)
    .eq("organizacao_id", contexto.organizacaoId);

  revalidatePath(`/rh/funcionarios/${pessoaId}`);
  revalidatePath("/rh/funcionarios");
  return {
    ok: true,
    mensagem: `Rescisão registrada. Total líquido estimado: R$ ${resultado.liquido.toFixed(2)}`,
  };
}

export async function alternarChecklistRescisao(
  rescisaoId: number,
  indice: number,
  pessoaId: number
): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { data } = await sb
    .from("rh_rescisoes")
    .select("id, checklist")
    .eq("id", rescisaoId)
    .maybeSingle();
  if (!data) return { erro: "Rescisão não encontrada." };

  const checklist = Array.isArray(data.checklist) ? [...data.checklist] : [];
  if (checklist[indice]) {
    checklist[indice] = { ...checklist[indice], ok: !checklist[indice].ok };
  }
  const { error } = await sb.from("rh_rescisoes").update({ checklist }).eq("id", rescisaoId);
  if (error) return { erro: error.message };

  revalidatePath(`/rh/funcionarios/${pessoaId}`);
  return { ok: true };
}
