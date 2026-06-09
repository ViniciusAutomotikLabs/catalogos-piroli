"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";

export type EstadoFormCliente = { erro?: string } | null;

export async function criarCliente(
  _estado: EstadoFormCliente,
  formData: FormData
): Promise<EstadoFormCliente> {
  const contexto = await getContextoLoja();
  if (!contexto?.lojaId) return { erro: "Sua conta não está vinculada a uma loja." };

  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  if (!razaoSocial) return { erro: "Razão social é obrigatória." };

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").insert({
    loja_id: contexto.lojaId,
    razao_social: razaoSocial,
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
  });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/clientes");
  redirect("/clientes");
}

function valor(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}
