"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";
import {
  blindIndexContato,
  blindIndexDocumento,
  cifrar,
  criptografiaConfigurada,
  mascararDocumento,
} from "@/lib/crypto";

export type EstadoFormPessoa =
  | { erro?: string; ok?: boolean; mensagem?: string }
  | null;

// ===== Domínio (whitelist de valores aceitos) =====

const PAPEIS_VALIDOS = [
  "cliente",
  "fornecedor",
  "vendedor",
  "funcionario",
  "entregador",
  "oficina",
  "mecanico",
  "custom",
] as const;
type Papel = (typeof PAPEIS_VALIDOS)[number];

const CANAIS_VALIDOS = ["email", "whatsapp", "sms"] as const;
type Canal = (typeof CANAIS_VALIDOS)[number];

const TIPOS_PESSOA = ["PF", "PJ"] as const;
const SITUACOES = ["ativo", "inativo"] as const;

// ===== Tipos de entrada (parseados do FormData) =====

type PapelInput = { papel: Papel; papel_custom: string | null };
type ContatoInput = {
  canal: Canal;
  valor: string;
  rotulo: string | null;
  recebe_fechamento: boolean;
  recebe_cobranca: boolean;
};
type EnderecoInput = {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  principal: boolean;
};
type VeiculoInput = {
  placa: string | null;
  veiculo: string | null;
  marca: string | null;
  ano: string | null;
  chassi: string | null;
};

type PessoaInput = {
  tipo_pessoa: "PF" | "PJ";
  nome: string;
  nome_fantasia: string | null;
  documento: string | null;
  foto_url: string | null;
  grupo_comercial_id: number | null;
  situacao: "ativo" | "inativo";
  papeis: PapelInput[];
  contatos: ContatoInput[];
  enderecos: EnderecoInput[];
  veiculos: VeiculoInput[];
};

// ===== Helpers de parsing/validação =====

function txt(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function parseJsonArray<T>(raw: string | null, mapItem: (o: Record<string, unknown>) => T | null): T[] {
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
      const mapped = mapItem(item as Record<string, unknown>);
      if (mapped) out.push(mapped);
    }
  }
  return out;
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

function parsePessoaInput(fd: FormData): { dados?: PessoaInput; erro?: string } {
  const tipo_pessoa = (txt(fd, "tipo_pessoa") ?? "PF").toUpperCase();
  if (!TIPOS_PESSOA.includes(tipo_pessoa as (typeof TIPOS_PESSOA)[number])) {
    return { erro: "Tipo de pessoa inválido." };
  }
  const nome = txt(fd, "nome");
  if (!nome) return { erro: "Nome é obrigatório." };

  const situacao = (txt(fd, "situacao") ?? "ativo").toLowerCase();
  if (!SITUACOES.includes(situacao as (typeof SITUACOES)[number])) {
    return { erro: "Situação inválida." };
  }

  const grupoRaw = txt(fd, "grupo_comercial_id");
  const grupo_comercial_id = grupoRaw ? Number(grupoRaw) : null;
  if (grupoRaw && !Number.isFinite(grupo_comercial_id)) {
    return { erro: "Grupo comercial inválido." };
  }

  const papeis = parseJsonArray<PapelInput>(txt(fd, "papeis"), (o) => {
    const papel = asStr(o, "papel") as Papel | null;
    if (!papel || !PAPEIS_VALIDOS.includes(papel)) return null;
    const papel_custom = asStr(o, "papel_custom");
    if (papel === "custom" && !papel_custom) return null;
    return { papel, papel_custom: papel === "custom" ? papel_custom : null };
  });

  const contatos = parseJsonArray<ContatoInput>(txt(fd, "contatos"), (o) => {
    const canal = asStr(o, "canal") as Canal | null;
    const valor = asStr(o, "valor");
    if (!canal || !CANAIS_VALIDOS.includes(canal) || !valor) return null;
    return {
      canal,
      valor,
      rotulo: asStr(o, "rotulo"),
      recebe_fechamento: asBool(o, "recebe_fechamento"),
      recebe_cobranca: asBool(o, "recebe_cobranca"),
    };
  });

  const enderecos = parseJsonArray<EnderecoInput>(txt(fd, "enderecos"), (o) => ({
    cep: asStr(o, "cep"),
    logradouro: asStr(o, "logradouro"),
    numero: asStr(o, "numero"),
    complemento: asStr(o, "complemento"),
    bairro: asStr(o, "bairro"),
    cidade: asStr(o, "cidade"),
    uf: asStr(o, "uf"),
    principal: asBool(o, "principal"),
  }));

  const veiculos = parseJsonArray<VeiculoInput>(txt(fd, "veiculos"), (o) => ({
    placa: asStr(o, "placa"),
    veiculo: asStr(o, "veiculo"),
    marca: asStr(o, "marca"),
    ano: asStr(o, "ano"),
    chassi: asStr(o, "chassi"),
  }));

  return {
    dados: {
      tipo_pessoa: tipo_pessoa as "PF" | "PJ",
      nome,
      nome_fantasia: txt(fd, "nome_fantasia"),
      documento: txt(fd, "documento"),
      foto_url: txt(fd, "foto_url"),
      grupo_comercial_id,
      situacao: situacao as "ativo" | "inativo",
      papeis,
      contatos,
      enderecos,
      veiculos,
    },
  };
}

// ===== Persistência de filhas (papéis/contatos/endereços/veículos) =====

async function inserirFilhas(
  sb: SupabaseClient,
  pessoaId: number,
  dados: PessoaInput
): Promise<string | null> {
  if (dados.papeis.length) {
    const { error } = await sb.from("pessoa_papeis").insert(
      dados.papeis.map((p) => ({
        pessoa_id: pessoaId,
        papel: p.papel,
        papel_custom: p.papel_custom,
      }))
    );
    if (error) return error.message;
  }

  if (dados.contatos.length) {
    const { error } = await sb.from("pessoa_contatos").insert(
      dados.contatos.map((c) => ({
        pessoa_id: pessoaId,
        canal: c.canal,
        valor_cifrado: cifrar(c.valor),
        valor_bidx: blindIndexContato(c.valor, c.canal),
        rotulo: c.rotulo,
        recebe_fechamento: c.recebe_fechamento,
        recebe_cobranca: c.recebe_cobranca,
      }))
    );
    if (error) return error.message;
  }

  if (dados.enderecos.length) {
    const { error } = await sb
      .from("pessoa_enderecos")
      .insert(dados.enderecos.map((e) => ({ pessoa_id: pessoaId, ...e })));
    if (error) return error.message;
  }

  if (dados.veiculos.length) {
    const { error } = await sb.from("pessoa_veiculos").insert(
      dados.veiculos.map((v) => ({
        pessoa_id: pessoaId,
        placa: v.placa,
        veiculo: v.veiculo,
        marca: v.marca,
        ano: v.ano,
        chassi_cifrado: cifrar(v.chassi),
      }))
    );
    if (error) return error.message;
  }

  return null;
}

async function registrarAuditoria(
  sb: SupabaseClient,
  organizacaoId: number,
  pessoaId: number,
  acao: "INSERT" | "UPDATE" | "DELETE",
  atorUserId: string | null
) {
  // Não bloqueia o fluxo se a auditoria falhar.
  try {
    await sb.from("auditoria").insert({
      organizacao_id: organizacaoId,
      tabela: "pessoas",
      registro_id: pessoaId,
      acao,
      ator_user_id: atorUserId,
    });
  } catch {
    /* noop */
  }
}

// ===== Actions =====

export async function criarPessoa(
  _estado: EstadoFormPessoa,
  formData: FormData
): Promise<EstadoFormPessoa> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) {
    return { erro: "Organização não configurada para sua loja." };
  }
  if (!criptografiaConfigurada()) {
    return { erro: "Criptografia não configurada (defina ERP_ENCRYPTION_KEY e ERP_BLIND_INDEX_KEY)." };
  }

  const { dados, erro } = parsePessoaInput(formData);
  if (erro || !dados) return { erro: erro ?? "Dados inválidos." };

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { data: pessoa, error } = await sb
    .from("pessoas")
    .insert({
      organizacao_id: contexto.organizacaoId,
      tipo_pessoa: dados.tipo_pessoa,
      nome: dados.nome,
      nome_fantasia: dados.nome_fantasia,
      documento_cifrado: cifrar(dados.documento),
      documento_bidx: blindIndexDocumento(dados.documento),
      documento_mascara: mascararDocumento(dados.documento),
      foto_url: dados.foto_url,
      grupo_comercial_id: dados.grupo_comercial_id,
      situacao: dados.situacao,
    })
    .select("id")
    .single();

  if (error || !pessoa) {
    return { erro: `Não foi possível salvar: ${error?.message ?? "erro desconhecido"}` };
  }

  const erroFilhas = await inserirFilhas(sb, pessoa.id as number, dados);
  if (erroFilhas) {
    return { erro: `Pessoa criada, mas houve erro nos detalhes: ${erroFilhas}` };
  }

  await registrarAuditoria(
    sb,
    contexto.organizacaoId,
    pessoa.id as number,
    "INSERT",
    contexto.user?.id ?? null
  );

  revalidatePath("/pessoas");
  redirect("/pessoas");
}

export async function atualizarPessoa(
  _estado: EstadoFormPessoa,
  formData: FormData
): Promise<EstadoFormPessoa> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) {
    return { erro: "Organização não configurada para sua loja." };
  }
  if (!criptografiaConfigurada()) {
    return { erro: "Criptografia não configurada." };
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return { erro: "Pessoa inválida." };

  const { dados, erro } = parsePessoaInput(formData);
  if (erro || !dados) return { erro: erro ?? "Dados inválidos." };

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  // Atualiza a pessoa (RLS garante que só a própria organização altera).
  const { error } = await sb
    .from("pessoas")
    .update({
      tipo_pessoa: dados.tipo_pessoa,
      nome: dados.nome,
      nome_fantasia: dados.nome_fantasia,
      documento_cifrado: cifrar(dados.documento),
      documento_bidx: blindIndexDocumento(dados.documento),
      documento_mascara: mascararDocumento(dados.documento),
      foto_url: dados.foto_url,
      grupo_comercial_id: dados.grupo_comercial_id,
      situacao: dados.situacao,
    })
    .eq("id", id)
    .eq("organizacao_id", contexto.organizacaoId);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  // Substitui as filhas (delete + reinsere) dentro do escopo da pessoa.
  for (const t of ["pessoa_papeis", "pessoa_contatos", "pessoa_enderecos", "pessoa_veiculos"]) {
    await sb.from(t).delete().eq("pessoa_id", id);
  }
  const erroFilhas = await inserirFilhas(sb, id, dados);
  if (erroFilhas) return { erro: `Atualizado, mas houve erro nos detalhes: ${erroFilhas}` };

  await registrarAuditoria(sb, contexto.organizacaoId, id, "UPDATE", contexto.user?.id ?? null);

  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${id}`);
  return { ok: true, mensagem: "Cadastro atualizado com sucesso." };
}

export async function excluirPessoa(id: number): Promise<EstadoFormPessoa> {
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return { erro: "Organização não configurada." };
  if (!Number.isFinite(id) || id <= 0) return { erro: "Pessoa inválida." };

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { error } = await sb
    .from("pessoas")
    .delete()
    .eq("id", id)
    .eq("organizacao_id", contexto.organizacaoId);

  if (error) return { erro: `Não foi possível excluir: ${error.message}` };

  await registrarAuditoria(sb, contexto.organizacaoId, id, "DELETE", contexto.user?.id ?? null);
  revalidatePath("/pessoas");
  redirect("/pessoas");
}
