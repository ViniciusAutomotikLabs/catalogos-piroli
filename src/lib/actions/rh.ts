"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";
import { cifrar, criptografiaConfigurada } from "@/lib/crypto";
import {
  serializarDadosBancarios,
  validarDadosBancarios,
  type DadosBancarios,
} from "@/lib/rh/dados-bancarios";

export type EstadoRH =
  | { erro?: string; ok?: boolean; mensagem?: string }
  | null;

// ===== Whitelists =====
const TIPOS_CONTRATO = ["clt", "experiencia", "estagio", "pj", "temporario"] as const;
const STATUS_CONTRATO = ["ativo", "afastado", "desligado"] as const;
const TIPOS_AFASTAMENTO = ["atestado", "inss", "licenca", "outro"] as const;
const TIPOS_ADVERTENCIA = ["verbal", "escrita", "suspensao"] as const;
const TIPOS_DOCUMENTO = ["contrato", "aso", "rg", "ctps", "comprovante", "outro"] as const;

// ===== Helpers de parsing =====
function txt(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}
function num(fd: FormData, key: string): number | null {
  const raw = txt(fd, key);
  if (raw == null) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function asStr(o: Record<string, unknown>, k: string): string | null {
  const v = o[k];
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}
function asBool(o: Record<string, unknown>, k: string): boolean {
  return o[k] === true || o[k] === "true" || o[k] === "on" || o[k] === 1;
}
function parseJsonArray<T>(raw: string | null, map: (o: Record<string, unknown>) => T | null): T[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: T[] = [];
  for (const item of parsed) {
    if (item && typeof item === "object") {
      const m = map(item as Record<string, unknown>);
      if (m) out.push(m);
    }
  }
  return out;
}

async function auditar(
  sb: SupabaseClient,
  organizacaoId: number,
  tabela: string,
  registroId: number | null,
  acao: "INSERT" | "UPDATE" | "DELETE",
  ator: string | null
) {
  try {
    await sb.from("auditoria").insert({
      organizacao_id: organizacaoId,
      tabela,
      registro_id: registroId,
      acao,
      ator_user_id: ator,
    });
  } catch {
    /* noop */
  }
}

/** Confirma que o contrato pertence à organização do usuário. Retorna o id ou null. */
async function contratoDaOrg(
  sb: SupabaseClient,
  contratoId: number,
  organizacaoId: number
): Promise<boolean> {
  const { data } = await sb
    .from("rh_contratos")
    .select("id")
    .eq("id", contratoId)
    .eq("organizacao_id", organizacaoId)
    .maybeSingle();
  return Boolean(data);
}

// ===== Contrato (ficha trabalhista) + dependentes =====

type DependenteInput = {
  nome: string;
  nascimento: string | null;
  parentesco: string | null;
  para_irrf: boolean;
  para_salario_familia: boolean;
};

export async function salvarContrato(_estado: EstadoRH, formData: FormData): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada para sua loja." };
  if (!criptografiaConfigurada()) {
    return { erro: "Criptografia não configurada (defina ERP_ENCRYPTION_KEY e ERP_BLIND_INDEX_KEY)." };
  }

  const pessoaId = Number(formData.get("pessoa_id"));
  if (!Number.isFinite(pessoaId) || pessoaId <= 0) return { erro: "Funcionário (pessoa) inválido." };

  const tipo_contrato = (txt(formData, "tipo_contrato") ?? "clt").toLowerCase();
  if (!TIPOS_CONTRATO.includes(tipo_contrato as (typeof TIPOS_CONTRATO)[number])) {
    return { erro: "Tipo de contrato inválido." };
  }
  const status = (txt(formData, "status") ?? "ativo").toLowerCase();
  if (!STATUS_CONTRATO.includes(status as (typeof STATUS_CONTRATO)[number])) {
    return { erro: "Status inválido." };
  }

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  // Garante que a pessoa é da organização.
  const { data: pessoa } = await sb
    .from("pessoas")
    .select("id")
    .eq("id", pessoaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .maybeSingle();
  if (!pessoa) return { erro: "Funcionário não encontrado nesta organização." };

  const bancarios: DadosBancarios = {
    banco: txt(formData, "banco"),
    agencia: txt(formData, "agencia"),
    conta: txt(formData, "conta"),
    tipo_conta: (txt(formData, "tipo_conta") as DadosBancarios["tipo_conta"]) ?? null,
    pix: txt(formData, "pix"),
  };
  const erroBanc = validarDadosBancarios(bancarios);
  if (erroBanc) return { erro: erroBanc };

  const registro = {
    organizacao_id: contexto.organizacaoId,
    pessoa_id: pessoaId,
    matricula: txt(formData, "matricula"),
    cargo: txt(formData, "cargo"),
    cbo: txt(formData, "cbo"),
    departamento: txt(formData, "departamento"),
    admissao: txt(formData, "admissao"),
    tipo_contrato,
    jornada_horas_semana: num(formData, "jornada_horas_semana") ?? 44,
    salario_base_cifrado: cifrar(txt(formData, "salario_base")),
    dados_bancarios_cifrado: cifrar(serializarDadosBancarios(bancarios)),
    sindicato: txt(formData, "sindicato"),
    status,
    desligamento_em: txt(formData, "desligamento_em"),
  };

  // Upsert por pessoa (1 contrato por pessoa).
  const { data: existente } = await sb
    .from("rh_contratos")
    .select("id")
    .eq("pessoa_id", pessoaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .maybeSingle();

  let contratoId: number;
  if (existente) {
    contratoId = existente.id as number;
    // organizacao_id é imutável (REVOKE UPDATE) — não reenviar.
    const { organizacao_id: _org, ...semOrg } = registro;
    void _org;
    const { error } = await sb.from("rh_contratos").update(semOrg).eq("id", contratoId);
    if (error) return { erro: `Não foi possível salvar: ${error.message}` };
    await auditar(sb, contexto.organizacaoId, "rh_contratos", contratoId, "UPDATE", contexto.user?.id ?? null);
  } else {
    const { data: novo, error } = await sb
      .from("rh_contratos")
      .insert(registro)
      .select("id")
      .single();
    if (error || !novo) return { erro: `Não foi possível salvar: ${error?.message ?? "erro"}` };
    contratoId = novo.id as number;
    await auditar(sb, contexto.organizacaoId, "rh_contratos", contratoId, "INSERT", contexto.user?.id ?? null);
  }

  // Dependentes: delete + reinsere no escopo do contrato.
  const dependentes = parseJsonArray<DependenteInput>(txt(formData, "dependentes"), (o) => {
    const nome = asStr(o, "nome");
    if (!nome) return null;
    return {
      nome,
      nascimento: asStr(o, "nascimento"),
      parentesco: asStr(o, "parentesco"),
      para_irrf: asBool(o, "para_irrf"),
      para_salario_familia: asBool(o, "para_salario_familia"),
    };
  });
  await sb.from("rh_dependentes").delete().eq("contrato_id", contratoId);
  if (dependentes.length) {
    await sb.from("rh_dependentes").insert(
      dependentes.map((d) => ({ contrato_id: contratoId, ...d }))
    );
  }

  revalidatePath("/rh/funcionarios");
  revalidatePath(`/rh/funcionarios/${pessoaId}`);
  return { ok: true, mensagem: "Ficha trabalhista salva." };
}

// ===== Documentos =====

export async function adicionarDocumento(_estado: EstadoRH, formData: FormData): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };

  const contratoId = Number(formData.get("contrato_id"));
  const pessoaId = Number(formData.get("pessoa_id"));
  const arquivo_url = txt(formData, "arquivo_url");
  const tipo = (txt(formData, "tipo") ?? "outro").toLowerCase();
  if (!Number.isFinite(contratoId) || !arquivo_url) return { erro: "Documento inválido." };
  if (!TIPOS_DOCUMENTO.includes(tipo as (typeof TIPOS_DOCUMENTO)[number])) {
    return { erro: "Tipo de documento inválido." };
  }

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  if (!(await contratoDaOrg(sb, contratoId, contexto.organizacaoId))) {
    return { erro: "Contrato não encontrado." };
  }

  const { error } = await sb.from("rh_documentos").insert({
    contrato_id: contratoId,
    tipo,
    arquivo_url,
    validade: txt(formData, "validade"),
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath(`/rh/funcionarios/${pessoaId}`);
  return { ok: true, mensagem: "Documento anexado." };
}

export async function removerDocumento(id: number, pessoaId: number): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const { error } = await sb.from("rh_documentos").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath(`/rh/funcionarios/${pessoaId}`);
  return { ok: true };
}

// ===== Afastamentos / atestados =====

export async function adicionarAfastamento(_estado: EstadoRH, formData: FormData): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  if (!criptografiaConfigurada()) return { erro: "Criptografia não configurada." };

  const contratoId = Number(formData.get("contrato_id"));
  const pessoaId = Number(formData.get("pessoa_id"));
  const tipo = (txt(formData, "tipo") ?? "atestado").toLowerCase();
  const inicio = txt(formData, "inicio");
  if (!Number.isFinite(contratoId) || !inicio) return { erro: "Afastamento inválido (início obrigatório)." };
  if (!TIPOS_AFASTAMENTO.includes(tipo as (typeof TIPOS_AFASTAMENTO)[number])) {
    return { erro: "Tipo de afastamento inválido." };
  }

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  if (!(await contratoDaOrg(sb, contratoId, contexto.organizacaoId))) {
    return { erro: "Contrato não encontrado." };
  }

  const { error } = await sb.from("rh_afastamentos").insert({
    contrato_id: contratoId,
    tipo,
    cid_cifrado: cifrar(txt(formData, "cid")), // dado de saúde: cifrado
    inicio,
    fim: txt(formData, "fim"),
    dias: num(formData, "dias"),
    documento_url: txt(formData, "documento_url"),
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath(`/rh/funcionarios/${pessoaId}`);
  return { ok: true, mensagem: "Afastamento registrado." };
}

export async function removerAfastamento(id: number, pessoaId: number): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const { error } = await sb.from("rh_afastamentos").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath(`/rh/funcionarios/${pessoaId}`);
  return { ok: true };
}

// ===== Advertências =====

export async function adicionarAdvertencia(_estado: EstadoRH, formData: FormData): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };

  const contratoId = Number(formData.get("contrato_id"));
  const pessoaId = Number(formData.get("pessoa_id"));
  const tipo = (txt(formData, "tipo") ?? "escrita").toLowerCase();
  const motivo = txt(formData, "motivo");
  const data = txt(formData, "data");
  if (!Number.isFinite(contratoId) || !motivo || !data) return { erro: "Advertência inválida." };
  if (!TIPOS_ADVERTENCIA.includes(tipo as (typeof TIPOS_ADVERTENCIA)[number])) {
    return { erro: "Tipo de advertência inválido." };
  }

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  if (!(await contratoDaOrg(sb, contratoId, contexto.organizacaoId))) {
    return { erro: "Contrato não encontrado." };
  }

  const { error } = await sb.from("rh_advertencias").insert({
    contrato_id: contratoId,
    tipo,
    motivo,
    data,
    documento_url: txt(formData, "documento_url"),
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath(`/rh/funcionarios/${pessoaId}`);
  return { ok: true, mensagem: "Advertência registrada." };
}

export async function removerAdvertencia(id: number, pessoaId: number): Promise<EstadoRH> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const { error } = await sb.from("rh_advertencias").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath(`/rh/funcionarios/${pessoaId}`);
  return { ok: true };
}
