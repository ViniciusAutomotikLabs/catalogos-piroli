import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ESPECIALIDADES: Record<string, string> = {
  multimarcas: "Multimarcas",
  especializada: "Especializada",
  linha_pesada: "Linha Pesada",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; esp?: string; status?: string }>;
}) {
  const params = await searchParams;
  const filtro = (params.f ?? "").trim();
  const esp = params.esp ?? "";
  const status = params.status ?? "";

  const supabase = await createClient();
  let query = supabase
    .from("clientes")
    .select(
      "id, razao_social, nome_fantasia, cnpj, contato_nome, telefone_whatsapp, especialidade, marcas, ativo, ultima_compra_em, cidade, uf, orcamentos(count)"
    )
    .order("ultima_compra_em", { ascending: false, nullsFirst: false })
    .order("razao_social", { ascending: true })
    .limit(100);

  if (filtro) {
    const pattern = `%${filtro.replace(/[,()%]/g, " ")}%`;
    query = query.or(`razao_social.ilike.${pattern},nome_fantasia.ilike.${pattern},cnpj.ilike.${pattern}`);
  }
  if (esp) query = query.eq("especialidade", esp);
  if (status === "ativos") query = query.eq("ativo", true);
  if (status === "inativos") query = query.eq("ativo", false);

  const { data: clientes } = await query;

  const buildUrl = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { f: filtro || undefined, esp: esp || undefined, status: status || undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/clientes?${s}` : "/clientes";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg text-primary font-bold">Gestão de Clientes</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Oficinas e parceiros da sua loja — {clientes?.length ?? 0} cadastros
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action="/clientes" className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              name="f"
              defaultValue={filtro}
              placeholder="Buscar oficinas..."
              className="pl-10 pr-3 py-2 bg-surface-container-lowest border border-outline-variant rounded text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors w-64"
            />
          </form>
          <Link
            href="/clientes/novo"
            className="flex items-center gap-2 px-4 py-2.5 rounded bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Novo Cadastro
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-label-sm text-on-surface-variant uppercase mr-1">Filtros:</span>
        {Object.entries(ESPECIALIDADES).map(([key, label]) => (
          <Link
            key={key}
            href={buildUrl({ esp: esp === key ? undefined : key })}
            className={
              esp === key
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

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
        {clientes && clientes.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-high border-b-2 border-outline-variant text-on-surface text-label-sm uppercase">
              <tr>
                <th className="px-4 py-3">Oficina / Contato</th>
                <th className="px-4 py-3 w-44">CNPJ / Cód.</th>
                <th className="px-4 py-3">Especialidade / Marcas</th>
                <th className="px-4 py-3 w-36">Última Compra</th>
                <th className="px-4 py-3 w-24">Orçamentos</th>
                <th className="px-4 py-3 w-28 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="text-body-md text-on-surface">
              {clientes.map((c, i) => {
                const qtdOrcamentos = (c.orcamentos as { count: number }[] | null)?.[0]?.count ?? 0;
                return (
                <tr
                  key={c.id}
                  className={`border-b border-outline-variant hover:bg-surface-container transition-colors group h-16 ${
                    i % 2 === 1 ? "bg-surface-container-low" : ""
                  }`}
                >
                  <td className="px-4 py-2">
                    <Link href={`/clientes/${c.id}`} className="block group/link">
                      <p className="font-bold text-on-surface flex items-center gap-2 group-hover/link:text-primary transition-colors">
                        {c.nome_fantasia ?? c.razao_social}
                      {!c.ativo && (
                        <span className="text-label-sm text-error uppercase border border-error/40 rounded px-1.5">
                          Inativo
                        </span>
                      )}
                    </p>
                    <p className="text-label-sm text-on-surface-variant font-normal mt-0.5">
                      {[c.contato_nome, c.telefone_whatsapp, c.cidade && `${c.cidade}/${c.uf ?? ""}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-code-md text-on-surface-variant">
                      {c.cnpj ?? `CLI-${String(c.id).padStart(4, "0")}`}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 bg-primary-fixed/30 text-label-sm text-primary uppercase">
                        {ESPECIALIDADES[c.especialidade ?? "multimarcas"]}
                      </span>
                      {(c.marcas ?? []).slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="inline-flex px-2 py-0.5 rounded border border-outline-variant bg-surface text-label-sm text-on-surface-variant uppercase"
                        >
                          {m}
                        </span>
                      ))}
                      {(c.marcas ?? []).length > 3 && (
                        <span className="text-label-sm text-on-surface-variant">
                          +{(c.marcas ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant">
                    {c.ultima_compra_em
                      ? new Date(c.ultima_compra_em).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-code-md text-on-surface-variant">
                    {qtdOrcamentos}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="inline-flex w-8 h-8 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary transition-colors items-center justify-center border border-transparent hover:border-primary"
                        title="Ver perfil"
                      >
                        <span className="material-symbols-outlined text-[18px]">person</span>
                      </Link>
                    {c.telefone_whatsapp && (
                      <a
                        href={`https://wa.me/55${c.telefone_whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-8 h-8 rounded bg-surface-container hover:bg-secondary hover:text-on-primary text-secondary transition-colors items-center justify-center border border-transparent hover:border-secondary opacity-0 group-hover:opacity-100"
                        title="Chamar no WhatsApp"
                      >
                        <span className="material-symbols-outlined text-[18px]">chat</span>
                      </a>
                    )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-outline text-5xl">group_off</span>
            <p className="text-headline-sm text-on-surface">Nenhum cliente cadastrado</p>
            <p className="text-body-md text-on-surface-variant">
              Comece cadastrando a primeira oficina parceira.
            </p>
            <Link
              href="/clientes/novo"
              className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Novo Cadastro
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
