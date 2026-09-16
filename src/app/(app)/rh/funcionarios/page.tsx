import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { AvisoSemOrganizacaoRH } from "@/components/rh/aviso-sem-org";

const STATUS_BADGE: Record<string, string> = {
  ativo: "text-primary border-primary/40 bg-primary-fixed/30",
  afastado: "text-tertiary border-tertiary/40 bg-tertiary-container/40",
  desligado: "text-error border-error/40 bg-error-container/40",
};

type ContratoEmbed = { cargo: string | null; status: string; departamento: string | null };

type FuncionarioRow = {
  id: number;
  nome: string;
  nome_fantasia: string | null;
  documento_mascara: string | null;
  rh_contratos: ContratoEmbed | ContratoEmbed[] | null;
};

/** PostgREST devolve objeto (1:1 por UNIQUE pessoa_id) ou array. */
function contratoDe(embed: FuncionarioRow["rh_contratos"]): ContratoEmbed | null {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

export default async function RHFuncionariosPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; status?: string }>;
}) {
  await requireModulo("rh");
  const contexto = await getContextoLoja();
  const params = await searchParams;
  const filtro = (params.f ?? "").trim();
  const status = params.status ?? "";

  if (!contexto?.organizacaoId) return <AvisoSemOrganizacaoRH />;

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const org = contexto.organizacaoId;

  // Fonte da verdade do status = rh_contratos (igual ao dashboard).
  // Pessoas com papel funcionário mas sem ficha ainda só entram na lista "todos".
  type ListaItem = {
    id: number;
    nome: string;
    nome_fantasia: string | null;
    cargo: string | null;
    departamento: string | null;
    status: string;
  };

  let lista: ListaItem[] = [];

  if (status === "ativo" || status === "afastado" || status === "desligado") {
    const { data } = await sb
      .from("rh_contratos")
      .select("cargo, status, departamento, pessoas(id, nome, nome_fantasia)")
      .eq("organizacao_id", org)
      .eq("status", status)
      .order("id", { ascending: true })
      .limit(200);
    type Row = {
      cargo: string | null;
      status: string;
      departamento: string | null;
      pessoas: { id: number; nome: string; nome_fantasia: string | null } | { id: number; nome: string; nome_fantasia: string | null }[] | null;
    };
    const pessoaDe = (p: Row["pessoas"]) => (Array.isArray(p) ? p[0] : p) ?? null;
    lista = ((data as Row[] | null) ?? [])
      .map((r) => {
        const p = pessoaDe(r.pessoas);
        if (!p) return null;
        return {
          id: p.id,
          nome: p.nome,
          nome_fantasia: p.nome_fantasia,
          cargo: r.cargo,
          departamento: r.departamento,
          status: r.status,
        };
      })
      .filter((x): x is ListaItem => x != null);
    if (filtro) {
      const n = filtro.toLowerCase();
      lista = lista.filter(
        (f) => f.nome.toLowerCase().includes(n) || (f.nome_fantasia ?? "").toLowerCase().includes(n)
      );
    }
  } else {
    const { data } = await sb
      .from("pessoas")
      .select(
        "id, nome, nome_fantasia, documento_mascara, pessoa_papeis!inner(papel), rh_contratos(cargo, status, departamento)"
      )
      .eq("organizacao_id", org)
      .eq("pessoa_papeis.papel", "funcionario")
      .order("nome", { ascending: true })
      .limit(200);
    let rows = (data as FuncionarioRow[] | null) ?? [];
    if (filtro) {
      const n = filtro.toLowerCase();
      rows = rows.filter(
        (f) => f.nome.toLowerCase().includes(n) || (f.nome_fantasia ?? "").toLowerCase().includes(n)
      );
    }
    lista = rows.map((f) => {
      const c = contratoDe(f.rh_contratos);
      return {
        id: f.id,
        nome: f.nome,
        nome_fantasia: f.nome_fantasia,
        cargo: c?.cargo ?? null,
        departamento: c?.departamento ?? null,
        status: c?.status ?? "sem contrato",
      };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">Funcionários</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Pessoas com papel funcionário — {lista.length} registro(s). Cadastro em{" "}
            <Link href="/pessoas/novo" className="text-primary hover:underline">
              Pessoas
            </Link>
            .
          </p>
        </div>
        <form action="/rh/funcionarios" className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
            search
          </span>
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="f"
            defaultValue={filtro}
            placeholder="Nome do funcionário…"
            className="pl-10 pr-3 py-2 bg-surface-container-lowest border border-outline-variant rounded text-body-md text-on-surface placeholder:text-outline focus:border-primary outline-none w-72"
          />
        </form>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-label-sm text-on-surface-variant mr-1">Status:</span>
        <Link
          href={filtro ? `/rh/funcionarios?f=${encodeURIComponent(filtro)}` : "/rh/funcionarios"}
          className={
            !status
              ? "bg-primary-container text-on-primary-container border border-primary px-3 py-1.5 rounded-full text-label-sm"
              : "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary px-3 py-1.5 rounded-full text-label-sm transition-colors"
          }
        >
          Todos
        </Link>
        {[
          ["ativo", "Ativos"],
          ["afastado", "Afastados"],
          ["desligado", "Desligados"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={
              status === key
                ? "/rh/funcionarios"
                : `/rh/funcionarios?status=${key}${filtro ? `&f=${encodeURIComponent(filtro)}` : ""}`
            }
            className={
              status === key
                ? "bg-primary-container text-on-primary-container border border-primary px-3 py-1.5 rounded-full text-label-sm"
                : "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary px-3 py-1.5 rounded-full text-label-sm transition-colors"
            }
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        {lista.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-high border-b border-outline-variant text-on-surface-variant text-label-sm">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Cargo</th>
                <th className="px-4 py-3 font-semibold">Departamento</th>
                <th className="px-4 py-3 w-32 font-semibold">Status</th>
                <th className="px-4 py-3 w-24 text-right font-semibold">Ficha</th>
              </tr>
            </thead>
            <tbody className="text-body-md text-on-surface">
            {lista.map((f, i) => {
                const st = f.status;
                return (
                  <tr
                    key={f.id}
                    className={`border-b border-outline-variant hover:bg-primary-fixed/40 transition-colors h-14 ${
                      i % 2 === 1 ? "bg-surface-container-low" : ""
                    }`}
                  >
                    <td className="px-4 py-2">
                      <Link href={`/rh/funcionarios/${f.id}`} className="font-bold hover:text-primary transition-colors">
                        {f.nome_fantasia ?? f.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-on-surface-variant">{f.cargo ?? "—"}</td>
                    <td className="px-4 py-2 text-on-surface-variant">{f.departamento ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded border text-label-sm uppercase capitalize ${
                          STATUS_BADGE[st] ?? "text-outline border-outline-variant"
                        }`}
                      >
                        {st}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/rh/funcionarios/${f.id}`}
                        className="inline-flex w-8 h-8 rounded-lg bg-surface-container hover:bg-primary hover:text-on-primary text-primary items-center justify-center"
                        title="Abrir ficha"
                      >
                        <span className="material-symbols-outlined text-[18px]">badge</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-outline text-5xl">groups</span>
            <p className="text-headline-sm text-on-surface">Nenhum funcionário</p>
            <p className="text-body-md text-on-surface-variant">
              Cadastre a pessoa em Pessoas com o papel &quot;Funcionário&quot; e gerencie aqui.
            </p>
            <Link
              href="/pessoas/novo"
              className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Cadastrar em Pessoas
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
