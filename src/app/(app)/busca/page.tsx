import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RegistrarConsulta } from "@/components/registrar-consulta";
import { WhatsAppRowButton } from "@/components/busca/whatsapp-row-button";

const POR_PAGINA = 25;

function sanitize(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; catalogo?: string; foto?: string; ordem?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const q = sanitize(params.q ?? "");
  const catalogo = params.catalogo ?? "";
  const comFoto = params.foto === "1";
  const ordem = params.ordem ?? "relevancia";
  const pagina = Math.max(1, parseInt(params.pagina ?? "1", 10) || 1);

  const supabase = await createClient();

  // Catálogos para os chips de filtro
  const { data: catalogos } = await supabase
    .from("catalogos")
    .select("slug, nome_exibicao")
    .eq("status", "ok")
    .order("produtos_count", { ascending: false })
    .limit(6);

  // Busca também por referência cruzada
  let idsPorReferencia: number[] = [];
  if (q) {
    const { data: refs } = await supabase
      .from("referencias_cruzadas")
      .select("produto_id")
      .ilike("numero_referencia", `%${q}%`)
      .limit(100);
    idsPorReferencia = (refs ?? [])
      .map((r) => r.produto_id)
      .filter((id): id is number => id !== null);
  }

  let query = supabase
    .from("produtos")
    .select(
      "id, codigo_produto_interno, numero_produto, descricao, foto_url, origem_catalogo, unidade, fabricantes(nome_fabricante)",
      { count: "exact" }
    );

  if (q) {
    const pattern = `%${q}%`;
    const orParts = [
      `codigo_produto_interno.ilike.${pattern}`,
      `numero_produto.ilike.${pattern}`,
      `descricao.ilike.${pattern}`,
    ];
    if (idsPorReferencia.length > 0) {
      orParts.push(`id.in.(${idsPorReferencia.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }
  if (catalogo) query = query.eq("origem_catalogo", catalogo);
  if (comFoto) query = query.not("foto_url", "is", null);

  query =
    ordem === "codigo"
      ? query.order("codigo_produto_interno", { ascending: true })
      : query.order("id", { ascending: true });

  const de = (pagina - 1) * POR_PAGINA;
  const { data: produtos, count } = await query.range(de, de + POR_PAGINA - 1);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const buildUrl = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, catalogo, foto: comFoto ? "1" : undefined, ordem, pagina: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/busca?${s}` : "/busca";
  };

  return (
    <div className="space-y-6 -mt-2">
      {q && <RegistrarConsulta termo={q} />}

      {/* Busca + filtros */}
      <div className="flex flex-col gap-4">
        <form action="/busca" className="flex items-center gap-4">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar por código, descrição ou referência..."
              className="w-full bg-surface-container-lowest border border-outline-variant rounded text-body-lg text-on-surface py-3 pl-12 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
          {catalogo && <input type="hidden" name="catalogo" value={catalogo} />}
          <button
            type="submit"
            className="bg-primary text-on-primary hover:bg-primary-container px-6 py-3 rounded flex items-center gap-2 text-label-sm uppercase transition-colors whitespace-nowrap"
          >
            <span className="material-symbols-outlined">search</span>
            Buscar
          </button>
        </form>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Link
              href={buildUrl({ catalogo: undefined, foto: comFoto ? "1" : undefined })}
              className={
                !catalogo
                  ? "bg-primary-container text-on-primary-container border border-primary px-3 py-1.5 rounded-full text-label-sm whitespace-nowrap"
                  : "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary hover:text-primary px-3 py-1.5 rounded-full text-label-sm whitespace-nowrap transition-colors"
              }
            >
              Todos
            </Link>
            <Link
              href={buildUrl({ foto: comFoto ? undefined : "1" })}
              className={
                comFoto
                  ? "bg-primary-container text-on-primary-container border border-primary px-3 py-1.5 rounded-full text-label-sm whitespace-nowrap flex items-center gap-1"
                  : "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary hover:text-primary px-3 py-1.5 rounded-full text-label-sm whitespace-nowrap transition-colors flex items-center gap-1"
              }
            >
              <span className="material-symbols-outlined text-[16px]">image</span> Com foto
            </Link>
            {(catalogos ?? []).map((c) => (
              <Link
                key={c.slug}
                href={buildUrl({ catalogo: catalogo === c.slug ? undefined : c.slug })}
                className={
                  catalogo === c.slug
                    ? "bg-primary-container text-on-primary-container border border-primary px-3 py-1.5 rounded-full text-label-sm whitespace-nowrap"
                    : "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary hover:text-primary px-3 py-1.5 rounded-full text-label-sm whitespace-nowrap transition-colors"
                }
              >
                {c.nome_exibicao ?? c.slug}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-label-sm text-on-surface-variant uppercase">Ordenar:</span>
            <Link
              href={buildUrl({ ordem: ordem === "codigo" ? undefined : "codigo" })}
              className="bg-surface-container-lowest border border-outline-variant rounded text-body-md text-on-surface py-1.5 px-3 hover:border-primary transition-colors"
            >
              {ordem === "codigo" ? "Código A–Z ✓" : "Relevância"}
            </Link>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
        {produtos && produtos.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-high border-b-2 border-outline-variant text-on-surface text-label-sm uppercase">
              <tr>
                <th className="px-4 py-3 w-16 text-center">Foto</th>
                <th className="px-4 py-3 w-36">Código</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 w-36">Fabricante</th>
                <th className="px-4 py-3 w-32">Catálogo</th>
                <th className="px-4 py-3 w-24 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="text-body-md text-on-surface">
              {produtos.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-outline-variant hover:bg-surface-container transition-all group h-14 ${
                    i % 2 === 1 ? "bg-surface-container-low" : "bg-surface-container-lowest"
                  }`}
                >
                  <td className="px-4 py-1 text-center">
                    {p.foto_url ? (
                      <div className="w-12 h-12 bg-white border border-outline-variant rounded flex items-center justify-center overflow-hidden shrink-0 mx-auto group-hover:border-primary transition-colors">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.foto_url}
                          alt={p.descricao ?? ""}
                          className="w-10 h-10 object-contain"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-surface-variant border border-outline-variant rounded flex items-center justify-center shrink-0 mx-auto text-outline group-hover:border-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">
                          image_not_supported
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-1 font-mono text-code-md text-primary">
                    <Link href={`/produtos/${p.id}`} className="hover:underline">
                      {p.codigo_produto_interno}
                    </Link>
                  </td>
                  <td className="px-4 py-1 font-semibold">{p.descricao ?? "—"}</td>
                  <td className="px-4 py-1 text-on-surface-variant">
                    {p.fabricantes?.nome_fabricante ?? "—"}
                  </td>
                  <td className="px-4 py-1">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-outline-variant bg-surface text-label-sm text-on-surface-variant uppercase">
                      <span className="w-2 h-2 rounded-full bg-secondary-fixed" />
                      {p.origem_catalogo}
                    </span>
                  </td>
                  <td className="px-4 py-1 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <WhatsAppRowButton
                        produto={{
                          descricao: p.descricao,
                          codigo: p.codigo_produto_interno,
                          numeroProduto: p.numero_produto,
                          fabricante: p.fabricantes?.nome_fabricante,
                          catalogo: p.origem_catalogo,
                          fotoUrl: p.foto_url,
                        }}
                      />
                      <Link
                        href={`/produtos/${p.id}`}
                        className="w-8 h-8 rounded bg-surface-container hover:bg-primary hover:text-on-primary transition-colors flex items-center justify-center border border-transparent hover:border-primary"
                        title="Ver Detalhes"
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-16 flex flex-col items-center justify-center text-center gap-2">
            <span className="material-symbols-outlined text-outline text-5xl">search_off</span>
            <p className="text-headline-sm text-on-surface">Nenhuma peça encontrada</p>
            <p className="text-body-md text-on-surface-variant">
              Tente outro código ou referência.
            </p>
          </div>
        )}

        {/* Paginação */}
        <div className="bg-surface-container-lowest border-t border-outline-variant px-4 py-3 flex items-center justify-between">
          <span className="text-body-md text-on-surface-variant">
            Mostrando{" "}
            <span className="font-bold text-on-surface">
              {total === 0 ? 0 : de + 1}–{Math.min(de + POR_PAGINA, total)}
            </span>{" "}
            de <span className="font-bold text-on-surface">{total}</span>
          </span>
          <div className="flex items-center gap-1">
            {pagina > 1 ? (
              <Link
                href={buildUrl({ pagina: String(pagina - 1) })}
                className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </Link>
            ) : (
              <span className="p-1 rounded text-outline opacity-50">
                <span className="material-symbols-outlined">chevron_left</span>
              </span>
            )}
            <span className="w-8 h-8 rounded flex items-center justify-center text-label-sm bg-primary text-on-primary">
              {pagina}
            </span>
            <span className="text-body-md text-on-surface-variant px-1">de {totalPaginas}</span>
            {pagina < totalPaginas ? (
              <Link
                href={buildUrl({ pagina: String(pagina + 1) })}
                className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </Link>
            ) : (
              <span className="p-1 rounded text-outline opacity-50">
                <span className="material-symbols-outlined">chevron_right</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
