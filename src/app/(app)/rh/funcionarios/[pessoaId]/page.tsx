import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { decifrar } from "@/lib/crypto";
import { FormContrato, type ContratoValores } from "@/components/rh/form-contrato";
import {
  SecoesFuncionario,
  type Documento,
  type Afastamento,
  type Advertencia,
} from "@/components/rh/secoes-funcionario";
import { FormFerias } from "@/components/rh/form-ferias";
import { AcoesFerias } from "@/components/rh/acoes-ferias";
import { FormRescisao, type RescisaoExistente } from "@/components/rh/form-rescisao";
import { AvisoSemOrganizacaoRH } from "@/components/rh/aviso-sem-org";

const brl = (v: number | null | undefined) => `R$ ${(v ?? 0).toFixed(2)}`;

function tentarDecifrar(v: string | null | undefined): string | null {
  try {
    return decifrar(v ?? null);
  } catch {
    return null;
  }
}

export default async function FichaFuncionarioPage({
  params,
}: {
  params: Promise<{ pessoaId: string }>;
}) {
  await requireModulo("rh");
  const contexto = await getContextoLoja();
  const { pessoaId: pessoaIdRaw } = await params;
  const pessoaId = Number(pessoaIdRaw);
  if (!Number.isFinite(pessoaId)) notFound();

  if (!contexto?.organizacaoId) return <AvisoSemOrganizacaoRH />;

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { data: pessoa } = await sb
    .from("pessoas")
    .select("id, nome, nome_fantasia")
    .eq("id", pessoaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .maybeSingle();
  if (!pessoa) notFound();

  const { data: contrato } = await sb
    .from("rh_contratos")
    .select(
      "id, matricula, cargo, cbo, departamento, admissao, tipo_contrato, jornada_horas_semana, salario_base_cifrado, dados_bancarios_cifrado, sindicato, status, desligamento_em, rh_dependentes(id, nome, nascimento, parentesco, para_irrf, para_salario_familia)"
    )
    .eq("pessoa_id", pessoaId)
    .eq("organizacao_id", contexto.organizacaoId)
    .maybeSingle();

  const contratoId: number | null = contrato ? (contrato.id as number) : null;

  const valores: ContratoValores | undefined = contrato
    ? {
        matricula: contrato.matricula,
        cargo: contrato.cargo,
        cbo: contrato.cbo,
        departamento: contrato.departamento,
        admissao: contrato.admissao,
        tipo_contrato: contrato.tipo_contrato,
        jornada_horas_semana: contrato.jornada_horas_semana,
        salario_base: tentarDecifrar(contrato.salario_base_cifrado as string | null),
        dados_bancarios: tentarDecifrar(contrato.dados_bancarios_cifrado as string | null),
        sindicato: contrato.sindicato,
        status: contrato.status,
        desligamento_em: contrato.desligamento_em,
        dependentes: (contrato.rh_dependentes ?? []).map(
          (d: {
            nome: string;
            nascimento: string | null;
            parentesco: string | null;
            para_irrf: boolean;
            para_salario_familia: boolean;
          }) => ({
            nome: d.nome,
            nascimento: d.nascimento,
            parentesco: d.parentesco,
            para_irrf: d.para_irrf,
            para_salario_familia: d.para_salario_familia,
          })
        ),
      }
    : undefined;

  // Filhas (só se já houver contrato).
  let documentos: Documento[] = [];
  let afastamentos: Afastamento[] = [];
  let advertencias: Advertencia[] = [];
  let ferias: {
    id: number;
    data_inicio_gozo: string | null;
    dias_gozo: number;
    abono_pecuniario_dias: number;
    valor_calculado: number | null;
    status: string;
    concessivo_ate: string | null;
  }[] = [];
  let rescisao: RescisaoExistente | null = null;

  if (contratoId) {
    const [docsRes, afastRes, advRes, ferRes, rescRes] = await Promise.all([
      sb.from("rh_documentos").select("id, tipo, arquivo_url, validade").eq("contrato_id", contratoId).order("criado_em", { ascending: false }),
      sb.from("rh_afastamentos").select("id, tipo, cid_cifrado, inicio, fim, dias, documento_url").eq("contrato_id", contratoId).order("inicio", { ascending: false }),
      sb.from("rh_advertencias").select("id, tipo, motivo, data").eq("contrato_id", contratoId).order("data", { ascending: false }),
      sb.from("rh_ferias").select("id, data_inicio_gozo, dias_gozo, abono_pecuniario_dias, valor_calculado, status, concessivo_ate").eq("contrato_id", contratoId).order("criado_em", { ascending: false }),
      sb.from("rh_rescisoes").select("id, tipo, motivo, data_desligamento, verbas, checklist").eq("contrato_id", contratoId).maybeSingle(),
    ]);

    documentos = (docsRes.data as Documento[] | null) ?? [];
    afastamentos = ((afastRes.data as { id: number; tipo: string; cid_cifrado: string | null; inicio: string; fim: string | null; dias: number | null; documento_url: string | null }[] | null) ?? []).map(
      (a) => ({
        id: a.id,
        tipo: a.tipo,
        cid: tentarDecifrar(a.cid_cifrado),
        inicio: a.inicio,
        fim: a.fim,
        dias: a.dias,
        documento_url: a.documento_url,
      })
    );
    advertencias = (advRes.data as Advertencia[] | null) ?? [];
    ferias = (ferRes.data as typeof ferias | null) ?? [];
    rescisao = (rescRes.data as RescisaoExistente | null) ?? null;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link
          href="/rh/funcionarios"
          className="inline-flex w-9 h-9 rounded-lg border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary items-center justify-center"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">
            {pessoa.nome_fantasia ?? pessoa.nome}
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Ficha trabalhista ·{" "}
            <Link href={`/pessoas/${pessoaId}`} className="text-primary hover:underline">
              ver cadastro em Pessoas
            </Link>
          </p>
        </div>
      </div>

      {!contexto && null}

      <FormContrato pessoaId={pessoaId} valores={valores} />

      {contratoId ? (
        <>
          {/* Férias */}
          <section className="space-y-3">
            <h2 className="text-headline-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">beach_access</span>
              Férias
            </h2>
            <FormFerias funcionarios={[]} contratoIdFixo={contratoId} />
            {ferias.length > 0 && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-body-md">
                  <thead className="bg-surface-container-high text-on-surface-variant text-label-sm">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Início gozo</th>
                      <th className="px-4 py-2 font-semibold">Dias</th>
                      <th className="px-4 py-2 font-semibold">Abono</th>
                      <th className="px-4 py-2 font-semibold">Valor</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ferias.map((f) => (
                      <tr key={f.id} className="border-t border-outline-variant">
                        <td className="px-4 py-2">{f.data_inicio_gozo ?? "—"}</td>
                        <td className="px-4 py-2">{f.dias_gozo}</td>
                        <td className="px-4 py-2">{f.abono_pecuniario_dias}</td>
                        <td className="px-4 py-2 font-mono">{brl(f.valor_calculado)}</td>
                        <td className="px-4 py-2 capitalize">{f.status}</td>
                        <td className="px-4 py-2">
                          <AcoesFerias id={f.id} status={f.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Documentos, afastamentos, advertências */}
          <SecoesFuncionario
            contratoId={contratoId}
            pessoaId={pessoaId}
            organizacaoId={contexto.organizacaoId}
            documentos={documentos}
            afastamentos={afastamentos}
            advertencias={advertencias}
          />

          {/* Rescisão */}
          <FormRescisao contratoId={contratoId} pessoaId={pessoaId} existente={rescisao} />
        </>
      ) : (
        <p className="text-body-md text-on-surface-variant bg-surface-container-low border border-outline-variant rounded-xl p-4">
          Salve a ficha trabalhista acima para habilitar férias, documentos, afastamentos,
          advertências e rescisão.
        </p>
      )}
    </div>
  );
}
