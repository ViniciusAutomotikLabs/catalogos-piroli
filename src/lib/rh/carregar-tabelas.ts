import type { SupabaseClient } from "@supabase/supabase-js";
import { montarTabelasLegais, type LinhaTabelaLegal, type TabelasLegais } from "./tabelas";

/**
 * Carrega as tabelas legais vigentes para um ano. Usa o ano pedido; se não houver
 * seed para ele, cai para o ano mais recente disponível <= ano (as tabelas valem até
 * serem atualizadas). Retorna um objeto vazio se a tabela ainda não existe no banco.
 */
export async function carregarTabelasLegais(
  sb: SupabaseClient,
  ano: number
): Promise<TabelasLegais> {
  try {
    const { data, error } = await sb
      .from("rh_tabelas_legais")
      .select("vigencia_ano, tipo, faixas")
      .lte("vigencia_ano", ano)
      .order("vigencia_ano", { ascending: false });

    if (error || !data || data.length === 0) return { ano };

    // Para cada tipo, mantém a linha de maior vigencia_ano (a lista já vem desc).
    const escolhidas = new Map<string, LinhaTabelaLegal>();
    for (const row of data as LinhaTabelaLegal[]) {
      if (!escolhidas.has(row.tipo)) escolhidas.set(row.tipo, row);
    }
    return montarTabelasLegais(ano, [...escolhidas.values()]);
  } catch {
    return { ano };
  }
}
