import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
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

export default async function RHDashboardPage() {
  await requireModulo("rh");
  const contexto = await getContextoLoja();
  if (!contexto?.organizacaoId) return <AvisoSemOrganizacaoRH />;

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const org = contexto.organizacaoId;
  const hoje = new Date().toISOString().slice(0, 10);
  const em60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const [ativosRes, afastadosRes, feriasRes, afastRes, compRes] = await Promise.all([
    sb.from("rh_contratos").select("id", { count: "exact", head: true }).eq("organizacao_id", org).eq("status", "ativo"),
    sb.from("rh_contratos").select("id", { count: "exact", head: true }).eq("organizacao_id", org).eq("status", "afastado"),
    sb
      .from("rh_ferias")
      .select("id, rh_contratos!inner(organizacao_id)", { count: "exact", head: true })
      .eq("rh_contratos.organizacao_id", org)
      .in("status", ["agendada"])
      .lte("concessivo_ate", em60),
    sb
      .from("rh_afastamentos")
      .select("id, rh_contratos!inner(organizacao_id)", { count: "exact", head: true })
      .eq("rh_contratos.organizacao_id", org)
      .or(`fim.is.null,fim.gte.${hoje}`),
    sb
      .from("rh_folha_competencias")
      .select("id, status")
      .eq("organizacao_id", org)
      .eq("ano", ano)
      .eq("mes", mes)
      .maybeSingle(),
  ]);

  const ativos = ativosRes.count ?? 0;
  const afastados = afastadosRes.count ?? 0;
  const feriasVencendo = feriasRes.count ?? 0;
  const afastamentosVigentes = afastRes.count ?? 0;
  const comp = compRes.data as { id: number; status: string } | null;

  const cards = [
    { label: "Funcionários ativos", valor: ativos, icone: "groups", href: "/rh/funcionarios?status=ativo", cor: "text-primary" },
    { label: "Afastados", valor: afastados, icone: "healing", href: "/rh/funcionarios?status=afastado", cor: "text-tertiary" },
    { label: "Férias vencendo (60d)", valor: feriasVencendo, icone: "beach_access", href: "/rh/ferias", cor: "text-tertiary" },
    { label: "Afastamentos vigentes", valor: afastamentosVigentes, icone: "sick", href: "/rh/funcionarios", cor: "text-on-surface" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">RH / Departamento Pessoal</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Ficha trabalhista, férias, folha e rescisão. O funcionário é cadastrado em Pessoas e
          gerenciado aqui.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm hover:border-primary transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className={`material-symbols-outlined text-3xl ${c.cor}`}>{c.icone}</span>
              <span className="text-headline-lg font-bold text-on-surface">{c.valor}</span>
            </div>
            <p className="text-body-md text-on-surface-variant mt-2 group-hover:text-primary transition-colors">
              {c.label}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="text-headline-sm text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">calendar_month</span>
            Folha de {MESES[mes]}/{ano}
          </h2>
          {comp ? (
            <div className="flex items-center justify-between">
              <span
                className={`text-label-sm px-2 py-0.5 rounded border uppercase ${
                  comp.status === "fechada"
                    ? "text-error border-error/40 bg-error-container/40"
                    : "text-primary border-primary/40 bg-primary-fixed/30"
                }`}
              >
                {comp.status}
              </span>
              <Link href={`/rh/folha?c=${comp.id}`} className="text-primary hover:underline text-body-md">
                Abrir folha →
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-body-md text-on-surface-variant">Competência ainda não aberta.</p>
              <Link href="/rh/folha" className="text-primary hover:underline text-body-md">
                Abrir competência →
              </Link>
            </div>
          )}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="text-headline-sm text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">bolt</span>
            Atalhos
          </h2>
          <div className="flex flex-col gap-2">
            <Link href="/rh/funcionarios" className="text-body-md text-on-surface hover:text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">badge</span> Funcionários
            </Link>
            <Link href="/rh/ferias" className="text-body-md text-on-surface hover:text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">beach_access</span> Férias
            </Link>
            <Link href="/rh/folha" className="text-body-md text-on-surface hover:text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">payments</span> Folha de pagamento
            </Link>
            <Link href="/pessoas/novo?papel=funcionario&origem=rh" className="text-body-md text-on-surface hover:text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">person_add</span> Cadastrar funcionário
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
