"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getContextoLoja } from "@/lib/loja";
import { isPapelMembro, type PapelMembro } from "@/lib/membros";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoConvite = { ok?: boolean; erro?: string; aviso?: string } | null;

function siteOrigin(headerList: Headers): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "");
  if (vercelHost) return `https://${vercelHost}`;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return "https://erp.autopecas.tech";
}

async function exigirDono() {
  const contexto = await getContextoLoja();
  if (!contexto?.lojaId) {
    return { erro: "Loja não encontrada." as const, contexto: null };
  }
  if (contexto.papel !== "dono" && !contexto.isSuperAdmin) {
    return { erro: "Apenas o dono pode gerenciar usuários." as const, contexto: null };
  }
  return { erro: null, contexto };
}

/**
 * Convida e-mail via Auth invite e vincula a `membros_loja`.
 * Se o usuário já existir, só vincula (e avisa para usar login).
 */
export async function convidarMembro(
  _prev: EstadoConvite,
  formData: FormData
): Promise<EstadoConvite> {
  const { erro: authErro, contexto } = await exigirDono();
  if (authErro || !contexto?.lojaId) return { erro: authErro ?? "Sem permissão." };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const papelRaw = String(formData.get("papel") ?? "vendedor").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erro: "Informe um e-mail válido." };
  }
  if (!isPapelMembro(papelRaw)) {
    return { erro: "Papel inválido." };
  }
  const papel: PapelMembro = papelRaw;
  if (papel === "dono" && !contexto.isSuperAdmin && contexto.papel !== "dono") {
    return { erro: "Sem permissão para convidar outro dono." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { erro: "Serviço de convite indisponível (service role não configurada)." };
  }

  const headerList = await headers();
  const origin = siteOrigin(headerList);
  const redirectTo = `${origin}/auth/callback?next=/inicio`;

  let userId: string | null = null;
  let jaExistia = false;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo }
  );

  if (inviteError) {
    const msg = inviteError.message.toLowerCase();
    const exists =
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists");

    if (!exists) {
      return { erro: `Não foi possível enviar o convite: ${inviteError.message}` };
    }

    jaExistia = true;
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) {
      return { erro: `Usuário já existe, mas não foi possível localizá-lo: ${listError.message}` };
    }
    const found = listed.users.find((u) => u.email?.toLowerCase() === email);
    if (!found) {
      return {
        erro: "Este e-mail já tem conta no Auth, mas não encontramos o usuário. Contate o suporte.",
      };
    }
    userId = found.id;
  } else {
    userId = invited.user?.id ?? null;
  }

  if (!userId) {
    return { erro: "Convite enviado, mas o usuário não retornou ID." };
  }

  const { error: upsertError } = await admin.from("membros_loja").upsert(
    {
      user_id: userId,
      loja_id: contexto.lojaId,
      papel,
    },
    { onConflict: "user_id,loja_id" }
  );

  if (upsertError) {
    return { erro: `Usuário criado, mas falhou o vínculo à loja: ${upsertError.message}` };
  }

  revalidatePath("/configuracoes");

  if (jaExistia) {
    return {
      ok: true,
      aviso:
        "Conta já existia — vinculamos à loja. Peça para entrar em /login com a senha atual (ou recuperar senha).",
    };
  }

  return { ok: true };
}

export async function alterarPapelMembro(
  userId: string,
  papel: string
): Promise<EstadoConvite> {
  const { erro: authErro, contexto } = await exigirDono();
  if (authErro || !contexto?.lojaId) return { erro: authErro ?? "Sem permissão." };
  if (!isPapelMembro(papel)) return { erro: "Papel inválido." };
  if (userId === contexto.user.id && papel !== "dono") {
    return { erro: "Você não pode remover o próprio papel de dono." };
  }

  const admin = createAdminClient();
  if (!admin) return { erro: "Serviço indisponível." };

  const { error } = await admin
    .from("membros_loja")
    .update({ papel })
    .eq("user_id", userId)
    .eq("loja_id", contexto.lojaId);

  if (error) return { erro: error.message };

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function revogarMembro(userId: string): Promise<EstadoConvite> {
  const { erro: authErro, contexto } = await exigirDono();
  if (authErro || !contexto?.lojaId) return { erro: authErro ?? "Sem permissão." };
  if (userId === contexto.user.id) {
    return { erro: "Você não pode remover a si mesmo." };
  }

  const admin = createAdminClient();
  if (!admin) return { erro: "Serviço indisponível." };

  const { error } = await admin
    .from("membros_loja")
    .delete()
    .eq("user_id", userId)
    .eq("loja_id", contexto.lojaId);

  if (error) return { erro: error.message };

  revalidatePath("/configuracoes");
  return { ok: true };
}
