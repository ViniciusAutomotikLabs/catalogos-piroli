import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";
import { buildContatoLojaUrl } from "@/lib/whatsapp";

export default async function DashboardPage() {
  const supabase = await createClient();
  const contexto = await getContextoLoja();

  const [{ count: catalogosAtivos }, { data: ultimoCatalogo }, { data: recentes }] =
    await Promise.all([
      supabase.from("catalogos").select("id", { count: "exact", head: true }).eq("status", "ok"),
      supabase
        .from("catalogos")
        .select("ultimo_job_em")
        .not("ultimo_job_em", "is", null)
        .order("ultimo_job_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("historico_consultas")
        .select(
          "id, termo, criado_em, produtos(id, codigo_produto_interno, descricao, foto_url, fabricantes(nome_fabricante))"
        )
        .not("produto_id", "is", null)
        .order("criado_em", { ascending: false })
        .limit(5),
    ]);

  const ultimaSync = ultimoCatalogo?.ultimo_job_em
    ? formatarDataRelativa(new Date(ultimoCatalogo.ultimo_job_em))
    : "—";

  return (
    <>
      {/* Hero de busca */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 shadow-sm flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden group hover:border-primary transition-colors">
        <div
          className="absolute inset-0 bg-surface-container-low opacity-50 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#c4c6cf 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="z-10 w-full max-w-3xl relative">
          <h2 className="text-headline-lg text-primary mb-6 text-center font-bold">
            Busca Rápida de Peças
          </h2>
          <form action="/busca" className="relative flex items-center w-full focus-within:ring-2 focus-within:ring-primary rounded-sm">
            <span className="material-symbols-outlined filled absolute left-4 text-outline">
              search
            </span>
            <input
              type="text"
              name="q"
              placeholder="Código, descrição ou referência (ex: 201.0813, PH2870A)"
              className="w-full py-4 pl-12 pr-32 bg-surface-container-lowest border border-outline-variant rounded-sm font-mono text-code-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-0 shadow-sm transition-colors h-14"
            />
            <button
              type="submit"
              className="absolute right-2 bg-primary text-on-primary px-6 py-2 rounded-sm text-label-sm uppercase hover:bg-primary-container transition-colors h-10"
            >
              Buscar
            </button>
          </form>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Link
              href="/veiculo"
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant rounded-full text-label-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">directions_car</span>
              Buscar por veículo
            </Link>
            <Link
              href="/historico"
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant rounded-full text-label-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              Últimas consultas
            </Link>
          </div>
        </div>
      </section>

      {/* Cards resumo */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm hover:border-primary transition-colors flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-secondary-fixed-dim/20 rounded-full text-secondary">
              <span className="material-symbols-outlined filled">menu_book</span>
            </div>
            <span className="text-label-sm text-on-surface-variant">Status Sistema</span>
          </div>
          <div>
            <p className="text-headline-lg font-bold text-on-surface">{catalogosAtivos ?? 0}</p>
            <p className="text-body-md text-on-surface-variant">Catálogos ativos</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm hover:border-primary transition-colors flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-primary-fixed-dim/20 rounded-full text-primary">
              <span className="material-symbols-outlined filled">update</span>
            </div>
            <span className="text-label-sm text-on-surface-variant">Sincronização</span>
          </div>
          <div>
            <p className="text-headline-md font-bold text-on-surface">{ultimaSync}</p>
            <p className="text-body-md text-on-surface-variant">Última atualização</p>
          </div>
        </div>

        <div className="bg-primary-container border border-primary-container rounded-lg p-6 shadow-sm hover:border-secondary transition-colors flex flex-col justify-between h-full text-on-primary-container">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-secondary rounded-full text-on-primary">
              <span className="material-symbols-outlined filled">forum</span>
            </div>
          </div>
          <div>
            <p className="text-headline-sm font-bold text-on-primary mb-2">Suporte Técnico</p>
            <p className="text-body-md mb-4">Dúvidas sobre compatibilidade?</p>
            <a
              href={buildContatoLojaUrl(contexto?.loja?.telefone_whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-secondary-fixed text-label-sm uppercase hover:underline"
            >
              Falar no WhatsApp
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
        </div>
      </section>

      {/* Consultados recentemente */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-headline-sm font-bold text-primary">Consultados recentemente</h3>
          <Link href="/historico" className="text-label-sm text-secondary hover:underline">
            Ver todo histórico
          </Link>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
          {recentes && recentes.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant">
                  <th className="py-3 px-4 text-label-sm uppercase">Produto</th>
                  <th className="py-3 px-4 text-label-sm uppercase">Código</th>
                  <th className="py-3 px-4 text-label-sm uppercase">Fabricante</th>
                  <th className="py-3 px-4 text-label-sm uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {recentes.map((r, i) => {
                  const p = r.produtos;
                  if (!p) return null;
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-outline-variant hover:bg-surface-container-high transition-colors ${
                        i % 2 === 1 ? "bg-[#F9FAFB]" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <Link href={`/produtos/${p.id}`} className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-surface-variant rounded flex items-center justify-center border border-outline-variant overflow-hidden">
                            {p.foto_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.foto_url}
                                alt=""
                                className="w-full h-full object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-outline">
                                settings_suggest
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-on-surface">{p.descricao ?? "—"}</p>
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono text-code-md text-on-surface">
                        {p.codigo_produto_interno}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {p.fabricantes?.nome_fabricante ?? "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/produtos/${p.id}`}
                          className="inline-flex p-2 text-on-surface-variant hover:text-primary transition-colors"
                          title="Reabrir"
                        >
                          <span className="material-symbols-outlined">open_in_new</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-12 flex flex-col items-center gap-2 text-center">
              <span className="material-symbols-outlined text-outline text-4xl">history</span>
              <p className="text-body-md text-on-surface-variant">
                Nenhuma consulta ainda. Use a busca acima para começar.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function formatarDataRelativa(data: Date) {
  const hoje = new Date();
  const mesmaData = data.toDateString() === hoje.toDateString();
  if (mesmaData) return "Hoje";
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-BR");
}
