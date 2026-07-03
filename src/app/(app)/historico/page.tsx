import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Consulta = {
  id: number;
  termo: string | null;
  contexto_veiculo: string | null;
  criado_em: string;
  produtos: {
    id: number;
    codigo_produto_interno: string;
    descricao: string | null;
  } | null;
};

function grupoDoDia(data: Date) {
  const hoje = new Date();
  if (data.toDateString() === hoje.toDateString()) return "Hoje";
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-BR");
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const filtro = (f ?? "").trim();

  const supabase = await createClient();
  let query = supabase
    .from("historico_consultas")
    .select(
      "id, termo, contexto_veiculo, criado_em, produtos(id, codigo_produto_interno, descricao)"
    )
    .order("criado_em", { ascending: false })
    .limit(100);

  if (filtro) query = query.ilike("termo", `%${filtro.replace(/[,()%]/g, " ")}%`);

  const { data } = await query;
  const consultas = (data ?? []) as Consulta[];

  const grupos = new Map<string, Consulta[]>();
  for (const c of consultas) {
    const g = grupoDoDia(new Date(c.criado_em));
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(c);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-headline-lg text-primary font-bold">Histórico de Consultas</h1>
        <form action="/historico" className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              filter_alt
            </span>
            <input
              type="text"
              name="f"
              defaultValue={filtro}
              placeholder="Filtrar histórico..."
              className="pl-10 pr-3 py-2 bg-surface-container-lowest border border-outline-variant rounded text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors w-72"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
          >
            Filtrar
          </button>
        </form>
      </div>

      {grupos.size === 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg py-16 flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-outline text-5xl">history</span>
          <p className="text-headline-sm text-on-surface">Nenhuma consulta registrada</p>
          <p className="text-body-md text-on-surface-variant">
            As buscas e produtos abertos aparecem aqui.
          </p>
        </div>
      )}

      {[...grupos.entries()].map(([grupo, itens]) => (
        <section key={grupo}>
          <h2 className="text-label-sm text-on-surface-variant uppercase mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            {grupo}
          </h2>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                <tr>
                  <th className="py-3 px-4 w-24">Hora</th>
                  <th className="py-3 px-4">Termo Buscado / Código</th>
                  <th className="py-3 px-4">Produto Aberto</th>
                  <th className="py-3 px-4 w-28 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {itens.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-t border-outline-variant hover:bg-surface-container-high transition-colors group ${
                      i % 2 === 1 ? "bg-surface-container-low/50" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-code-md text-on-surface-variant">
                      {new Date(c.criado_em).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4">
                      {c.termo ? (
                        <span className="font-semibold text-on-surface">{c.termo}</span>
                      ) : (
                        <span className="text-on-surface-variant">— (abriu detalhe)</span>
                      )}
                      {c.contexto_veiculo && (
                        <span className="block text-label-sm text-on-surface-variant mt-0.5">
                          {c.contexto_veiculo}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {c.produtos ? (
                        <Link
                          href={`/produtos/${c.produtos.id}`}
                          className="text-primary hover:underline"
                        >
                          <span className="font-mono text-code-md">
                            {c.produtos.codigo_produto_interno}
                          </span>{" "}
                          · {c.produtos.descricao ?? ""}
                        </Link>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={
                          c.termo
                            ? `/busca?q=${encodeURIComponent(c.termo)}`
                            : c.produtos
                              ? `/produtos/${c.produtos.id}`
                              : "/busca"
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase"
                      >
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                        Repetir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
