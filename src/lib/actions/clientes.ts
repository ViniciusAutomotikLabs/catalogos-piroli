"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";

export type EstadoFormCliente = { erro?: string; ok?: boolean; mensagem?: string } | null;

function valor(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function dadosFormCliente(formData: FormData) {
  return {
    razao_social: String(formData.get("razao_social") ?? "").trim(),
    nome_fantasia: valor(formData, "nome_fantasia"),
    cnpj: valor(formData, "cnpj"),
    contato_nome: valor(formData, "contato_nome"),
    telefone_whatsapp: valor(formData, "telefone_whatsapp"),
    email: valor(formData, "email"),
    especialidade: valor(formData, "especialidade") ?? "multimarcas",
    marcas: formData.getAll("marcas").map(String),
    cep: valor(formData, "cep"),
    logradouro: valor(formData, "logradouro"),
    numero: valor(formData, "numero"),
    complemento: valor(formData, "complemento"),
    bairro: valor(formData, "bairro"),
    cidade: valor(formData, "cidade"),
    uf: valor(formData, "uf"),
  };
}

export async function criarCliente(
  _estado: EstadoFormCliente,
  formData: FormData
): Promise<EstadoFormCliente> {
  const contexto = await getContextoLoja();
  if (!contexto?.lojaId) return { erro: "Sua conta não está vinculada a uma loja." };

  const dados = dadosFormCliente(formData);
  if (!dados.razao_social) return { erro: "Razão social é obrigatória." };

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").insert({
    loja_id: contexto.lojaId,
    ...dados,
  });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function atualizarCliente(
  _estado: EstadoFormCliente,
  formData: FormData
): Promise<EstadoFormCliente> {
  const contexto = await getContextoLoja();
  if (!contexto?.lojaId) return { erro: "Sua conta não está vinculada a uma loja." };

  const id = Number(formData.get("id"));
  if (!id) return { erro: "Cliente inválido." };

  const dados = dadosFormCliente(formData);
  if (!dados.razao_social) return { erro: "Razão social é obrigatória." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update({
      ...dados,
      ativo: formData.get("ativo") === "on",
    })
    .eq("id", id)
    .eq("loja_id", contexto.lojaId);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true, mensagem: "Cadastro atualizado com sucesso." };
}
