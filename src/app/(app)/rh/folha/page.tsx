import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { AbrirCompetencia, AcoesCompetencia } from "@/components/rh/acoes-folha";
import { EditorItemFolha, type ItemFolha } from "@/components/rh/editor-item-folha";
import { AvisoSemOrganizacaoRH } from "@/components/rh/aviso-sem-org";

const MESES = [
  "",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const brl = (v: number | null | undefined) => `R$ ${(v ?? 0).toFixed(2)}`;

type Competencia = { id: number; ano: number; mes: number; status: string };
type ItemRow = {
  id: number;
  competencia_id: number;
  salario_base: number;
  proventos: { descricao: string; valor: number }[] | null;
  descontos: { descricao: string; valor: number }[] | null;
  inss: number;
  irrf: number;
  fgts: number;
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  rh_contratos: { pessoas: { nome: string; nome_fantasia: string | null } | null } | null;
};

export default async function RHFolhaPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  await requireModulo("rh");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return <AvisoSemOrganizacaoRH />;

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const params = await searchParams;

  const { data: compsData } = await sb
    .from("rh_folha_competencias")
    .select("id, ano, mes, status")
    .eq("organizacao_id", contexto.organizacaoId)
    .order("ano", { ascending: false })
    .order("mes", { ascending: false })
    .limit(36);
  const competencias = (compsData as Competencia[] | null) ?? [];

  const selecionadaId = params.c ? Number(params.c) : competencias[0]?.id ?? null;
  const selecionada = competencias.find((c) => c.id === selecionadaId) ?? null;

  let itens: ItemFolha[] = [];
  if (selecionada) {
    const { data: itensData } = await sb
      .from("rh_folha_itens")
      .select(
        "id, competencia_id, salario_base, proventos, descontos, inss, irrf, fgts, total_proventos, total_descontos, liquido, rh_contratos(pessoas(nome, nome_fantasia))"
      )
      .eq("competencia_id", selecionada.id);
    itens = ((itensData as ItemRow[] | null) ?? []).map((r) => ({
      id: r.id,
      competenciaId: r.competencia_id,
      nome: r.rh_contratos?.pessoas?.nome_fantasia ?? r.rh_contratos?.pessoas?.nome ?? `Contrato`,
      salarioBase: Number(r.salario_base),
      proventos: r.proventos ?? [],
      descontos: r.descontos ?? [],
      inss: Number(r.inss),
      irrf: Number(r.irrf),
      fgts: Number(r.fgts),
      totalProventos: Number(r.total_proventos),
      totalDescontos: Number(r.total_descontos),
      liquido: Number(r.liquido),
    }));
    itens.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  const totalLiquido = itens.reduce((s, i) => s + i.liquido, 0);
  const totalFgts = itens.reduce((s, i) => s + i.fgts, 0);
  const agora = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">Folha de Pagamento</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Fechamento por competência com cálculo de INSS/IRRF/FGTS. Sem eSocial — exporte para o
          contador.
        </p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
        <AbrirCompetencia anoAtual={agora.getFullYear()} mesAtual={agora.getMonth() + 1} />
      </div>

      {competencias.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-xl">
          <span className="material-symbols-outlined text-outline text-5xl">calendar_month</span>
          <p className="text-headline-sm text-on-surface">Nenhuma competência aberta</p>
          <p className="text-body-md text-on-surface-variant">Abra a primeira competência acima.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {competencias.map((c) => (
              <Link
                key={c.id}
                href={`/rh/folha?c=${c.id}`}
                className={
                  c.id === selecionadaId
                    ? "bg-primary-container text-on-primary-container border border-primary px-3 py-1.5 rounded-full text-label-sm"
                    : "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary px-3 py-1.5 rounded-full text-label-sm transition-colors"
                }
              >
                {MESES[c.mes]}/{c.ano}
                {c.status === "fechada" && " 🔒"}
              </Link>
            ))}
          </div>

          {selecionada && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <h2 className="text-headline-sm text-on-surface">
                    {MESES[selecionada.mes]}/{selecionada.ano}
                  </h2>
                  <span
                    className={`text-label-sm px-2 py-0.5 rounded border uppercase ${
                      selecionada.status === "fechada"
                        ? "text-error border-error/40 bg-error-container/40"
                        : "text-primary border-primary/40 bg-primary-fixed/30"
                    }`}
                  >
                    {selecionada.status}
                  </span>
                </div>
                <AcoesCompetencia competenciaId={selecionada.id} status={selecionada.status} />
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                {itens.length > 0 ? (
                  <table className="w-full text-left border-collapse text-body-md">
                    <thead className="bg-surface-container-high text-on-surface-variant text-label-sm">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Funcionário</th>
                        <th className="px-4 py-3 text-right font-semibold">Salário</th>
                        <th className="px-4 py-3 text-right font-semibold">INSS</th>
                        <th className="px-4 py-3 text-right font-semibold">IRRF</th>
                        <th className="px-4 py-3 text-right font-semibold">FGTS</th>
                        <th className="px-4 py-3 text-right font-semibold">Líquido</th>
                        <th className="px-4 py-3 text-right font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-on-surface">
                      {itens.map((item) => (
                        <EditorItemFolha
                          key={item.id}
                          item={item}
                          fechada={selecionada.status === "fechada"}
                        />
                      ))}
                    </tbody>
                    <tfoot className="bg-surface-container-high text-on-surface font-semibold">
                      <tr>
                        <td className="px-4 py-3">Totais ({itens.length})</td>
                        <td colSpan={3} />
                        <td className="px-4 py-3 text-right font-mono">{brl(totalFgts)}</td>
                        <td className="px-4 py-3 text-right font-mono text-primary">{brl(totalLiquido)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="py-12 flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-4xl">group_add</span>
                    <p className="text-body-md text-on-surface-variant">
                      Nenhum item. Clique em <strong>Gerar itens</strong> para trazer os funcionários
                      ativos.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
