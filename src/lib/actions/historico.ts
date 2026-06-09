"use server";

import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";

export async function registrarConsulta(
  termo: string | null,
  produtoId?: number | null
) {
  const contexto = await getContextoLoja();
  if (!contexto?.lojaId) return;
  const supabase = await createClient();
  await supabase.from("historico_consultas").insert({
    loja_id: contexto.lojaId,
    user_id: contexto.user.id,
    termo,
    produto_id: produtoId ?? null,
  });
}

export async function removerConsulta(id: number) {
  const supabase = await createClient();
  await supabase.from("historico_consultas").delete().eq("id", id);
}
