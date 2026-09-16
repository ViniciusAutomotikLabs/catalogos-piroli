import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { FormFerias, type OpcaoFuncionario } from "@/components/rh/form-ferias";
import { AcoesFerias } from "@/components/rh/acoes-ferias";
import { AvisoSemOrganizacaoRH } from "@/components/rh/aviso-sem-org";

const brl = (v: number | null | undefined) => `R$ ${(v ?? 0).toFixed(2)}`;

type FeriasRow = {
  id: number;
  data_inicio_gozo: string | null;
  dias_gozo: number;
  abono_pecuniario_dias: number;
  valor_calculado: number | null;
  status: string;
  concessivo_ate: string | null;
  rh_contratos: {
    organizacao_id: number;
    pessoas: { nome: string; nome_fantasia: string | null } | null;
  } | null;
};

function diasAte(data: string | null): number | null {
  if (!data) return null;
  const alvo = new Date(data + "T00:00:00");
  const hoje = new Date();
  return Math.floor((alvo.getTime() - hoje.getTime()) / 86400000);
}

export default async function RHFeriasPage() {
  await requireModulo("rh");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return <AvisoSemOrganizacaoRH />;

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { data: contratos } = await sb
    .from("rh_contratos")
    .select("id, pessoas(nome, nome_fantasia)")
    .eq("organizacao_id", contexto.organizacaoId)
    .eq("status", "ativo")
    .order("id", { ascending: true });

  const funcionarios: OpcaoFuncionario[] = (
    (contratos as { id: number; pessoas: { nome: string; nome_fantasia: string | null } | null }[] | null) ?? []
  ).map((c) => ({
    contratoId: c.id,
    nome: c.pessoas?.nome_fantasia ?? c.pessoas?.nome ?? `Contrato #${c.id}`,
  }));

  const { data: feriasData } = await sb
    .from("rh_ferias")
    .select(
      "id, data_inicio_gozo, dias_gozo, abono_pecuniario_dias, valor_calculado, status, concessivo_ate, rh_contratos!inner(organizacao_id, pessoas(nome, nome_fantasia))"
    )
    .eq("rh_contratos.organizacao_id", contexto.organizacaoId)
    .order("concessivo_ate", { ascending: true, nullsFirst: false })
    .limit(200);

  const ferias = (feriasData as FeriasRow[] | null) ?? [];

  const vencendo = ferias.filter((f) => {
    if (f.status === "gozada" || f.status === "paga") return false;
    const d = diasAte(f.concessivo_ate);
    return d !== null && d <= 60;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">Férias</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Agende, calcule o valor (salário + 1/3) e acompanhe vencimentos.
        </p>
      </div>

      {vencendo.length > 0 && (
        <div className="bg-tertiary-container/40 border border-tertiary/40 rounded-xl p-4">
          <p className="text-body-md text-on-surface flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-tertiary">warning</span>
            <strong>{vencendo.length}</strong> período(s) de férias vencendo ou vencidos:
          </p>
          <ul className="text-body-md text-on-surface-variant space-y-1">
            {vencendo.map((f) => {
              const d = diasAte(f.concessivo_ate);
              return (
                <li key={f.id}>
                  {f.rh_contratos?.pessoas?.nome_fantasia ?? f.rh_contratos?.pessoas?.nome ?? "—"} —{" "}
                  {d !== null && d < 0 ? `vencido há ${-d} dias` : `vence em ${d} dias`} (
                  {f.concessivo_ate})
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <FormFerias funcionarios={funcionarios} />

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        {ferias.length > 0 ? (
          <table className="w-full text-left border-collapse text-body-md">
            <thead className="bg-surface-container-high text-on-surface-variant text-label-sm">
              <tr>
                <th className="px-4 py-3 font-semibold">Funcionário</th>
                <th className="px-4 py-3 font-semibold">Início gozo</th>
                <th className="px-4 py-3 font-semibold">Dias</th>
                <th className="px-4 py-3 font-semibold">Abono</th>
                <th className="px-4 py-3 font-semibold">Concessivo até</th>
                <th className="px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              {ferias.map((f, i) => (
                <tr
                  key={f.id}
                  className={`border-t border-outline-variant ${i % 2 === 1 ? "bg-surface-container-low" : ""}`}
                >
                  <td className="px-4 py-2 font-medium">
                    {f.rh_contratos?.pessoas?.nome_fantasia ?? f.rh_contratos?.pessoas?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-2">{f.data_inicio_gozo ?? "—"}</td>
                  <td className="px-4 py-2">{f.dias_gozo}</td>
                  <td className="px-4 py-2">{f.abono_pecuniario_dias}</td>
                  <td className="px-4 py-2">{f.concessivo_ate ?? "—"}</td>
                  <td className="px-4 py-2 font-mono">{brl(f.valor_calculado)}</td>
                  <td className="px-4 py-2 capitalize">{f.status}</td>
                  <td className="px-4 py-2">
                    <AcoesFerias id={f.id} status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-16 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-outline text-5xl">beach_access</span>
            <p className="text-headline-sm text-on-surface">Nenhuma férias agendada</p>
            <p className="text-body-md text-on-surface-variant">Use o formulário acima para agendar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
