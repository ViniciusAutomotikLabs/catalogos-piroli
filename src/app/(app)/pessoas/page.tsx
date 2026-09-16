import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { blindIndexDocumento, blindIndexContato } from "@/lib/crypto";

const PAPEL_LABEL: Record<string, string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  vendedor: "Vendedor",
  funcionario: "Funcionário",
  entregador: "Entregador",
  oficina: "Oficina",
  mecanico: "Mecânico",
  custom: "Outro",
};

type PessoaRow = {
  id: number;
  tipo_pessoa: string;
  nome: string;
  nome_fantasia: string | null;
  documento_mascara: string | null;
  situacao: string;
  pessoa_papeis: { papel: string; papel_custom: string | null }[] | null;
};

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; papel?: string; status?: string }>;
}) {
  await requireModulo("pessoas");
  const contexto = await getContextoLoja();
  const params = await searchParams;
  const filtro = (params.f ?? "").trim();
  const papel = params.papel ?? "";
  const status = params.status ?? "";

  if (!contexto?.organizacaoId) {
    return <AvisoSemOrganizacao />;
  }

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  let query = sb
    .from("pessoas")
    .select(
      "id, tipo_pessoa, nome, nome_fantasia, documento_mascara, situacao, pessoa_papeis(papel, papel_custom)"
    )
    .eq("organizacao_id", contexto.organizacaoId)
    .order("nome", { ascending: true })
    .limit(100);

  if (status === "ativos") query = query.eq("situacao", "ativo");
  if (status === "inativos") query = query.eq("situacao", "inativo");

  // Busca: nome (ilike) OU documento/contato exatos (blind index).
  if (filtro) {
    const bidxDoc = blindIndexDocumento(filtro);
    const bidxWa = blindIndexContato(filtro, "whatsapp");
    if (bidxDoc && /\d/.test(filtro)) {
      // Parece documento/telefone: tenta índice cego em pessoas.
      const { data: idsDoc } = await sb
        .from("pessoas")
        .select("id")
        .eq("organizacao_id", contexto.organizacaoId)
        .eq("documento_bidx", bidxDoc);
      const { data: contatoMatch } = await sb
        .from("pessoa_contatos")
        .select("pessoa_id")
        .eq("valor_bidx", bidxWa ?? bidxDoc);
      const ids = new Set<number>();
      (idsDoc ?? []).forEach((r: { id: number }) => ids.add(r.id));
      (contatoMatch ?? []).forEach((r: { pessoa_id: number }) => ids.add(r.pessoa_id));
      // Também permite busca por nome mesmo com dígitos.
      const pattern = `%${filtro.replace(/[,()%]/g, " ")}%`;
      if (ids.size > 0) {
        query = query.or(`nome.ilike.${pattern},id.in.(${[...ids].join(",")})`);
      } else {
        query = query.ilike("nome", pattern);
      }
    } else {
      const pattern = `%${filtro.replace(/[,()%]/g, " ")}%`;
      query = query.or(`nome.ilike.${pattern},nome_fantasia.ilike.${pattern}`);
    }
  }

  if (papel) {
    const { data: papelIds } = await sb
      .from("pessoa_papeis")
      .select("pessoa_id")
      .eq("papel", papel);
    const ids = (papelIds ?? []).map((r: { pessoa_id: number }) => r.pessoa_id);
    query = ids.length ? query.in("id", ids) : query.eq("id", -1);
  }

  const { data: pessoas } = await query;
  const lista = (pessoas as PessoaRow[] | null) ?? [];

  const buildUrl = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { f: filtro || undefined, papel: papel || undefined, status: status || undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/pessoas?${s}` : "/pessoas";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">Pessoas</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Clientes, fornecedores, vendedores e equipe — {lista.length} cadastros
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action="/pessoas" className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              name="f"
              defaultValue={filtro}
              placeholder="Nome, CPF/CNPJ ou telefone..."
              className="pl-10 pr-3 py-2 bg-surface-container-lowest border border-outline-variant rounded text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors w-72"
            />
          </form>
          <Link
            href="/pessoas/novo"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Nova Pessoa
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-label-sm text-on-surface-variant mr-1">Papel:</span>
        {Object.entries(PAPEL_LABEL)
          .filter(([k]) => k !== "custom")
          .map(([key, label]) => (
            <Link
              key={key}
              href={buildUrl({ papel: papel === key ? undefined : key })}
              className={
                papel === key
                  ? "bg-primary-container text-on-primary-container border border-primary px-3 py-1.5 rounded-full text-label-sm"
                  : "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary hover:text-primary px-3 py-1.5 rounded-full text-label-sm transition-colors"
              }
            >
              {label}
            </Link>
          ))}
        <span className="w-px h-5 bg-outline-variant mx-1" />
        {[
          ["ativos", "Ativos"],
          ["inativos", "Inativos"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={buildUrl({ status: status === key ? undefined : key })}
            className={
              status === key
                ? "bg-primary-container text-on-primary-container border border-primary px-3 py-1.5 rounded-full text-label-sm"
                : "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary hover:text-primary px-3 py-1.5 rounded-full text-label-sm transition-colors"
            }
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        {lista.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-high border-b border-outline-variant text-on-surface-variant text-label-sm tracking-wide">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 w-32 font-semibold">Tipo</th>
                <th className="px-4 py-3 w-44 font-semibold">Documento</th>
                <th className="px-4 py-3 font-semibold">Papéis</th>
                <th className="px-4 py-3 w-24 text-right font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody className="text-body-md text-on-surface">
              {lista.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-outline-variant hover:bg-primary-fixed/40 transition-colors h-16 ${
                    i % 2 === 1 ? "bg-surface-container-low" : ""
                  }`}
                >
                  <td className="px-4 py-2">
                    <Link href={`/pessoas/${p.id}`} className="block group/link">
                      <p className="font-bold text-on-surface flex items-center gap-2 group-hover/link:text-primary transition-colors">
                        {p.nome_fantasia ?? p.nome}
                        {p.situacao === "inativo" && (
                          <span className="text-label-sm text-error uppercase border border-error/40 rounded px-1.5">
                            Inativo
                          </span>
                        )}
                      </p>
                      {p.nome_fantasia && (
                        <p className="text-label-sm text-on-surface-variant font-normal mt-0.5">{p.nome}</p>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant">
                    {p.tipo_pessoa === "PJ" ? "Jurídica" : "Física"}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-code-md text-on-surface-variant">
                      {p.documento_mascara ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(p.pessoa_papeis ?? []).map((pp, idx) => (
                        <span
                          key={idx}
                          className="inline-flex px-2 py-0.5 rounded border border-primary/30 bg-primary-fixed/30 text-label-sm text-primary uppercase"
                        >
                          {pp.papel === "custom" ? pp.papel_custom : PAPEL_LABEL[pp.papel] ?? pp.papel}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/pessoas/${p.id}`}
                      className="inline-flex w-8 h-8 rounded-lg bg-surface-container hover:bg-primary hover:text-on-primary text-primary transition-colors items-center justify-center border border-transparent hover:border-primary"
                      title="Ver / editar"
                      aria-label="Ver ou editar pessoa"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-16 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-outline text-5xl">group_off</span>
            <p className="text-headline-sm text-on-surface">Nenhuma pessoa cadastrada</p>
            <p className="text-body-md text-on-surface-variant">Cadastre o primeiro cliente ou fornecedor.</p>
            <Link
              href="/pessoas/novo"
              className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Nova Pessoa
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function AvisoSemOrganizacao() {
  return (
    <div className="max-w-2xl mx-auto mt-10 bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-primary text-5xl">database</span>
      <h1 className="text-headline-sm text-on-surface">Módulo Pessoas quase pronto</h1>
      <p className="text-body-md text-on-surface-variant">
        As migrations do ERP 2.0 (007–010) ainda não foram aplicadas no banco, ou sua loja ainda não
        está vinculada a uma organização. Assim que o banco estiver migrado, esta tela ativa
        automaticamente.
      </p>
    </div>
  );
}
