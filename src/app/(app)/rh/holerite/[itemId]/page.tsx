import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { montarHolerite, type Rubrica } from "@/lib/rh/folha";
import { BotaoImprimir } from "@/components/rh/botao-imprimir";

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
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ItemHolerite = {
  salario_base: number;
  proventos: Rubrica[] | null;
  descontos: Rubrica[] | null;
  inss: number;
  irrf: number;
  fgts: number;
  rh_folha_competencias: { ano: number; mes: number; organizacao_id: number } | null;
  rh_contratos: {
    cargo: string | null;
    matricula: string | null;
    pessoas: { nome: string; nome_fantasia: string | null } | null;
  } | null;
};

export default async function HoleritePage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  await requireModulo("rh");
  const contexto = await getContextoLoja();
  const { itemId: itemIdRaw } = await params;
  const itemId = Number(itemIdRaw);
  if (!Number.isFinite(itemId) || !contexto?.organizacaoId) notFound();

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { data } = await sb
    .from("rh_folha_itens")
    .select(
      "salario_base, proventos, descontos, inss, irrf, fgts, rh_folha_competencias!inner(ano, mes, organizacao_id), rh_contratos(cargo, matricula, pessoas(nome, nome_fantasia))"
    )
    .eq("id", itemId)
    .eq("rh_folha_competencias.organizacao_id", contexto.organizacaoId)
    .maybeSingle();

  const item = data as ItemHolerite | null;
  if (!item) notFound();

  const holerite = montarHolerite({
    salarioBase: Number(item.salario_base),
    proventos: item.proventos ?? [],
    descontos: item.descontos ?? [],
    inss: Number(item.inss),
    irrf: Number(item.irrf),
    fgts: Number(item.fgts),
  });

  const comp = item.rh_folha_competencias;
  const nome = item.rh_contratos?.pessoas?.nome_fantasia ?? item.rh_contratos?.pessoas?.nome ?? "—";
  const empresa = contexto.loja?.nome ?? "Empresa";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-headline-sm text-on-surface">Holerite</h1>
        <BotaoImprimir />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-sm print:shadow-none print:border-0 text-on-surface">
        <div className="flex items-start justify-between border-b border-outline-variant pb-4 mb-4">
          <div>
            <p className="text-headline-sm font-bold">{empresa}</p>
            <p className="text-body-md text-on-surface-variant">Recibo de Pagamento de Salário</p>
          </div>
          <div className="text-right">
            <p className="text-body-md font-semibold">
              {comp ? `${MESES[comp.mes]}/${comp.ano}` : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-body-md mb-4">
          <div>
            <span className="text-on-surface-variant">Funcionário: </span>
            <strong>{nome}</strong>
          </div>
          <div>
            <span className="text-on-surface-variant">Matrícula: </span>
            {item.rh_contratos?.matricula ?? "—"}
          </div>
          <div>
            <span className="text-on-surface-variant">Cargo: </span>
            {item.rh_contratos?.cargo ?? "—"}
          </div>
        </div>

        <table className="w-full text-body-md border-collapse mb-4">
          <thead>
            <tr className="border-y border-outline-variant text-label-sm text-on-surface-variant">
              <th className="text-left py-2">Descrição</th>
              <th className="text-right py-2">Provento</th>
              <th className="text-right py-2">Desconto</th>
            </tr>
          </thead>
          <tbody>
            {holerite.proventos.map((r, i) => (
              <tr key={`p${i}`} className="border-b border-outline-variant/50">
                <td className="py-1.5">{r.descricao}</td>
                <td className="py-1.5 text-right font-mono">{brl(r.valor)}</td>
                <td className="py-1.5" />
              </tr>
            ))}
            {holerite.descontos.map((r, i) => (
              <tr key={`d${i}`} className="border-b border-outline-variant/50">
                <td className="py-1.5">{r.descricao}</td>
                <td className="py-1.5" />
                <td className="py-1.5 text-right font-mono">{brl(r.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-outline-variant font-semibold">
              <td className="py-2">Totais</td>
              <td className="py-2 text-right font-mono">{brl(holerite.totalProventos)}</td>
              <td className="py-2 text-right font-mono">{brl(holerite.totalDescontos)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="flex justify-between items-center bg-primary-fixed/30 rounded-lg px-4 py-3">
          <span className="text-body-lg font-semibold">Líquido a receber</span>
          <span className="text-headline-sm font-bold text-primary font-mono">{brl(holerite.liquido)}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 text-body-md text-on-surface-variant">
          <div>FGTS do mês (informativo): {brl(holerite.fgts)}</div>
          <div className="text-right">Base INSS: {brl(Number(item.salario_base))}</div>
        </div>

        <div className="mt-10 pt-6 border-t border-outline-variant text-center text-label-sm text-on-surface-variant">
          <div className="inline-block border-t border-on-surface w-64 pt-1">Assinatura do funcionário</div>
        </div>
      </div>
    </div>
  );
}
