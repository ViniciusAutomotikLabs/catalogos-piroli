"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";
import { decifrar } from "@/lib/crypto";
import { carregarTabelasLegais } from "@/lib/rh/carregar-tabelas";
import {
  calcularINSS,
  calcularIRRF,
  calcularFGTS,
  calcularSalarioFamilia,
  montarHolerite,
  type Rubrica,
} from "@/lib/rh/folha";

export type EstadoRH = { erro?: string; ok?: boolean; mensagem?: string } | null;

function txt(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function parseRubricas(raw: string | null): Rubrica[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Rubrica[] = [];
  for (const item of parsed) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const descricao = String(o.descricao ?? "").trim();
      const valor = Number(o.valor);
      if (descricao && Number.isFinite(valor)) out.push({ descricao, valor });
    }
  }
  return out;
}

function salarioDeCifrado(cif: string | null): number {
  if (!cif) return 0;
  try {
    return Number(decifrar(cif) ?? 0) || 0;
  } catch {
    return 0;
  }
}

// ===== Competência =====

export async function abrirCompetencia(_estado: EstadoRH, formData: FormData): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };

  const ano = Number(txt(formData, "ano"));
  const mes = Number(txt(formData, "mes"));
  if (!Number.isFinite(ano) || ano < 2000 || ano > 2100) return { erro: "Ano inválido." };
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) return { erro: "Mês inválido." };

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { data: existente } = await sb
    .from("rh_folha_competencias")
    .select("id")
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();
  if (existente) return { erro: "Competência já existe." };

  const { error } = await sb.from("rh_folha_competencias").insert({
    organizacao_id: contexto.organizacaoId,
    ano,
    mes,
    status: "aberta",
  });
  if (error) return { erro: `Não foi possível abrir: ${error.message}` };

  revalidatePath("/rh/folha");
  return { ok: true, mensagem: `Competência ${String(mes).padStart(2, "0")}/${ano} aberta.` };
}

/** Verifica se a competência pertence à org e retorna status. */
async function competenciaDaOrg(
  sb: SupabaseClient,
  competenciaId: number,
  organizacaoId: number
): Promise<{ id: number; ano: number; status: string } | null> {
  const { data } = await sb
    .from("rh_folha_competencias")
    .select("id, ano, status")
    .eq("id", competenciaId)
    .eq("organizacao_id", organizacaoId)
    .maybeSingle();
  return data
    ? { id: data.id as number, ano: data.ano as number, status: data.status as string }
    : null;
}

/**
 * Gera itens para todos os funcionários ativos que ainda não têm item na competência,
 * calculando as rubricas legais a partir do salário (decifrado) e das tabelas do ano.
 */
export async function gerarItensCompetencia(competenciaId: number): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const comp = await competenciaDaOrg(sb, competenciaId, contexto.organizacaoId);
  if (!comp) return { erro: "Competência não encontrada." };
  if (comp.status === "fechada") return { erro: "Competência fechada." };

  const tabelas = await carregarTabelasLegais(sb, comp.ano);
  if (!tabelas.inss || !tabelas.irrf || !tabelas.fgts) {
    return { erro: "Tabelas legais (INSS/IRRF/FGTS) não configuradas para o ano." };
  }

  // Contratos ativos + dependentes.
  const { data: contratos } = await sb
    .from("rh_contratos")
    .select("id, salario_base_cifrado, rh_dependentes(para_irrf, para_salario_familia)")
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("status", "ativo");

  const { data: jaTem } = await sb
    .from("rh_folha_itens")
    .select("contrato_id")
    .eq("competencia_id", competenciaId);
  const existentes = new Set((jaTem ?? []).map((r: { contrato_id: number }) => r.contrato_id));

  type ContratoRow = {
    id: number;
    salario_base_cifrado: string | null;
    rh_dependentes: { para_irrf: boolean; para_salario_familia: boolean }[] | null;
  };

  const novos: Record<string, unknown>[] = [];
  for (const c of (contratos as ContratoRow[] | null) ?? []) {
    if (existentes.has(c.id)) continue;
    const salario = salarioDeCifrado(c.salario_base_cifrado);
    const deps = c.rh_dependentes ?? [];
    const depIrrf = deps.filter((d) => d.para_irrf).length;
    const depSalFam = deps.filter((d) => d.para_salario_familia).length;

    const inss = calcularINSS(salario, tabelas.inss);
    const irrf = calcularIRRF(salario - inss, depIrrf, tabelas.irrf);
    const fgts = calcularFGTS(salario, tabelas.fgts);
    const salFam = tabelas.salarioFamilia
      ? calcularSalarioFamilia(salario, depSalFam, tabelas.salarioFamilia)
      : 0;

    const proventosAuto: Rubrica[] =
      salFam > 0 ? [{ descricao: "Salário-família", valor: salFam }] : [];
    const holerite = montarHolerite({
      salarioBase: salario,
      proventos: proventosAuto,
      descontos: [],
      inss,
      irrf,
      fgts,
    });

    novos.push({
      competencia_id: competenciaId,
      contrato_id: c.id,
      salario_base: salario,
      proventos: proventosAuto,
      descontos: [],
      inss,
      irrf,
      fgts,
      total_proventos: holerite.totalProventos,
      total_descontos: holerite.totalDescontos,
      liquido: holerite.liquido,
    });
  }

  if (novos.length) {
    const { error } = await sb.from("rh_folha_itens").insert(novos);
    if (error) return { erro: `Não foi possível gerar itens: ${error.message}` };
  }

  revalidatePath(`/rh/folha`);
  return { ok: true, mensagem: `${novos.length} funcionário(s) adicionado(s) à folha.` };
}

/** Recalcula um item a partir do salário armazenado + rubricas manuais + tabelas. */
async function recalcular(
  sb: SupabaseClient,
  itemId: number,
  proventos: Rubrica[],
  descontos: Rubrica[],
  ano: number
): Promise<string | null> {
  const { data: item } = await sb
    .from("rh_folha_itens")
    .select("id, salario_base, contrato_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return "Item não encontrado.";

  const tabelas = await carregarTabelasLegais(sb, ano);
  if (!tabelas.inss || !tabelas.irrf || !tabelas.fgts) return "Tabelas legais não configuradas.";

  // Dependentes do contrato para salário-família/IRRF.
  const { data: deps } = await sb
    .from("rh_dependentes")
    .select("para_irrf, para_salario_familia")
    .eq("contrato_id", item.contrato_id);
  const depIrrf = (deps ?? []).filter((d: { para_irrf: boolean }) => d.para_irrf).length;
  const depSalFam = (deps ?? []).filter(
    (d: { para_salario_familia: boolean }) => d.para_salario_familia
  ).length;

  const salario = Number(item.salario_base) || 0;
  const inss = calcularINSS(salario, tabelas.inss);
  const irrf = calcularIRRF(salario - inss, depIrrf, tabelas.irrf);
  const fgts = calcularFGTS(salario, tabelas.fgts);
  const salFam = tabelas.salarioFamilia
    ? calcularSalarioFamilia(salario, depSalFam, tabelas.salarioFamilia)
    : 0;

  const proventosComAuto: Rubrica[] = [
    ...proventos,
    ...(salFam > 0 ? [{ descricao: "Salário-família", valor: salFam }] : []),
  ];
  const holerite = montarHolerite({
    salarioBase: salario,
    proventos: proventosComAuto,
    descontos,
    inss,
    irrf,
    fgts,
  });

  const { error } = await sb
    .from("rh_folha_itens")
    .update({
      // Persistimos proventos JÁ com o salário-família (rubrica automática), para o
      // holerite bater linha a linha com os totais.
      proventos: proventosComAuto,
      descontos,
      inss,
      irrf,
      fgts,
      total_proventos: holerite.totalProventos,
      total_descontos: holerite.totalDescontos,
      liquido: holerite.liquido,
    })
    .eq("id", itemId);
  return error ? error.message : null;
}

/** Salva rubricas manuais de um item e recalcula. */
export async function salvarItemFolha(_estado: EstadoRH, formData: FormData): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };

  const itemId = Number(formData.get("item_id"));
  const competenciaId = Number(formData.get("competencia_id"));
  if (!Number.isFinite(itemId) || !Number.isFinite(competenciaId)) return { erro: "Item inválido." };

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const comp = await competenciaDaOrg(sb, competenciaId, contexto.organizacaoId);
  if (!comp) return { erro: "Competência não encontrada." };
  if (comp.status === "fechada") return { erro: "Competência fechada — reabra para editar." };

  // Remove a rubrica automática de salário-família dos proventos manuais para não
  // duplicar (ela é recalculada e reanexada em `recalcular`).
  const proventos = parseRubricas(txt(formData, "proventos")).filter(
    (r) => r.descricao.trim().toLowerCase() !== "salário-família"
  );
  const descontos = parseRubricas(txt(formData, "descontos"));

  const erro = await recalcular(sb, itemId, proventos, descontos, comp.ano);
  if (erro) return { erro: `Não foi possível salvar: ${erro}` };

  revalidatePath("/rh/folha");
  return { ok: true, mensagem: "Lançamentos salvos e recalculados." };
}

export async function fecharCompetencia(competenciaId: number): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const comp = await competenciaDaOrg(sb, competenciaId, contexto.organizacaoId);
  if (!comp) return { erro: "Competência não encontrada." };
  const { error } = await sb
    .from("rh_folha_competencias")
    .update({ status: "fechada", fechado_em: new Date().toISOString() })
    .eq("id", competenciaId);
  if (error) return { erro: error.message };
  revalidatePath("/rh/folha");
  return { ok: true, mensagem: "Competência fechada." };
}

export async function reabrirCompetencia(competenciaId: number): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const comp = await competenciaDaOrg(sb, competenciaId, contexto.organizacaoId);
  if (!comp) return { erro: "Competência não encontrada." };
  const { error } = await sb
    .from("rh_folha_competencias")
    .update({ status: "aberta", fechado_em: null })
    .eq("id", competenciaId);
  if (error) return { erro: error.message };
  revalidatePath("/rh/folha");
  return { ok: true, mensagem: "Competência reaberta." };
}

export async function removerItemFolha(itemId: number): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const { error } = await sb.from("rh_folha_itens").delete().eq("id", itemId);
  if (error) return { erro: error.message };
  revalidatePath("/rh/folha");
  return { ok: true };
}
