import type { SupabaseClient } from "@supabase/supabase-js";
import { getOllamaEnv } from "@/lib/env";
import { getContextoLoja } from "@/lib/loja";
import { moduloLiberado } from "@/lib/modulos";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Módulo de IA do ERP 2.0 — "nossa OpenAI".
 *
 * A inferência roda no DGX com Ollama, acessível apenas pela rede privada
 * (Tailscale). O app fala com o Ollama SEMPRE server-side (`OLLAMA_BASE_URL`
 * aponta para o IP Tailscale) — nunca expõe o endpoint ao browser.
 *
 * Monetização desde o dia 1: toda chamada mede tokens e debita no `token_ledger`
 * (append-only) além de logar em `ia_uso`. Recarga/gateway ficam para P2.
 *
 * Degradação graciosa: se o módulo não estiver liberado, sem saldo, sem config
 * de Ollama ou sem service_role, retorna um resultado explicando o motivo em vez
 * de lançar — a UI mostra o aviso.
 */

export type ChatMensagem = { role: "system" | "user" | "assistant"; content: string };

export type ResultadoIA =
  | {
      ok: true;
      conteudo: string;
      modelo: string;
      promptTokens: number;
      completionTokens: number;
    }
  | {
      ok: false;
      motivo:
        | "modulo_desativado"
        | "ollama_nao_configurado"
        | "sem_saldo"
        | "sem_loja"
        | "erro_inferencia"
        | "medicao_indisponivel";
      mensagem: string;
    };

type OpcoesChat = {
  mensagens: ChatMensagem[];
  /** Sobrescreve o modelo padrão (OLLAMA_MODEL). */
  modelo?: string;
  temperatura?: number;
};

/** Saldo de tokens da loja (view token_saldo). 0 se indisponível. */
async function saldoTokens(sb: SupabaseClient, lojaId: number): Promise<number> {
  try {
    const { data } = await sb
      .from("token_saldo")
      .select("saldo")
      .eq("loja_id", lojaId)
      .maybeSingle();
    return Number((data as { saldo: number } | null)?.saldo ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Registra o uso e debita o ledger (service_role — a RLS bloqueia authenticated).
 * Best-effort: nunca derruba a resposta ao usuário se a contabilidade falhar,
 * mas loga no console para observabilidade.
 */
async function medirConsumo(params: {
  lojaId: number;
  userId: string | null;
  modelo: string;
  promptTokens: number;
  completionTokens: number;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[ia] service_role ausente: uso de IA não contabilizado.");
    return;
  }
  const total = params.promptTokens + params.completionTokens;
  try {
    const { data: uso } = await admin
      .from("ia_uso")
      .insert({
        loja_id: params.lojaId,
        user_id: params.userId,
        modelo: params.modelo,
        prompt_tokens: params.promptTokens,
        completion_tokens: params.completionTokens,
      })
      .select("id")
      .single();

    if (total > 0) {
      await admin.from("token_ledger").insert({
        loja_id: params.lojaId,
        tipo: "debito",
        tokens: total,
        origem: "uso_ia",
        referencia_id: (uso as { id: number } | null)?.id ?? null,
        descricao: `Uso IA (${params.modelo}): ${params.promptTokens}+${params.completionTokens} tokens`,
      });
    }
  } catch (e) {
    console.error("[ia] falha ao contabilizar consumo:", e);
  }
}

/**
 * Estima tokens quando o backend não retorna a contagem (fallback grosseiro:
 * ~4 chars por token). Usado só se o Ollama não devolver *_eval_count.
 */
function estimarTokens(texto: string): number {
  return Math.max(1, Math.ceil(texto.length / 4));
}

/**
 * Chat com o modelo local, com enforcement de módulo + saldo e medição de tokens.
 */
export async function chatIA(opcoes: OpcoesChat): Promise<ResultadoIA> {
  const contexto = await getContextoLoja();
  if (!contexto?.lojaId) {
    return { ok: false, motivo: "sem_loja", mensagem: "Sua conta não está vinculada a uma loja." };
  }
  if (!moduloLiberado("ia", contexto.modulos ?? null)) {
    return { ok: false, motivo: "modulo_desativado", mensagem: "O módulo de IA não está ativo para esta loja." };
  }

  const { baseUrl, model } = getOllamaEnv();
  if (!baseUrl) {
    return {
      ok: false,
      motivo: "ollama_nao_configurado",
      mensagem: "IA indisponível: defina OLLAMA_BASE_URL (IP Tailscale do DGX).",
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      motivo: "medicao_indisponivel",
      mensagem: "IA indisponível: service_role não configurada para medir consumo.",
    };
  }

  // Bloqueia se não houver saldo (medição desde o dia 1).
  const saldo = await saldoTokens(admin, contexto.lojaId);
  if (saldo <= 0) {
    return {
      ok: false,
      motivo: "sem_saldo",
      mensagem: "Sem saldo de tokens. Faça uma recarga para usar a IA.",
    };
  }

  const modelo = opcoes.modelo ?? model;

  let resposta: Response;
  try {
    resposta = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        messages: opcoes.mensagens,
        stream: false,
        options: opcoes.temperatura != null ? { temperature: opcoes.temperatura } : undefined,
      }),
      // Evita travar a request por muito tempo se a rede Tailscale cair.
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    console.error("[ia] erro ao chamar Ollama:", e);
    return { ok: false, motivo: "erro_inferencia", mensagem: "Não foi possível contatar o serviço de IA." };
  }

  if (!resposta.ok) {
    return { ok: false, motivo: "erro_inferencia", mensagem: `Serviço de IA respondeu ${resposta.status}.` };
  }

  const json = (await resposta.json()) as {
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };
  const conteudo = json.message?.content ?? "";
  const promptTokens = json.prompt_eval_count ?? estimarTokens(opcoes.mensagens.map((m) => m.content).join(" "));
  const completionTokens = json.eval_count ?? estimarTokens(conteudo);

  await medirConsumo({
    lojaId: contexto.lojaId,
    userId: contexto.user?.id ?? null,
    modelo,
    promptTokens,
    completionTokens,
  });

  return { ok: true, conteudo, modelo, promptTokens, completionTokens };
}
