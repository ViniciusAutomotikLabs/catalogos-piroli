import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RegistrarConsulta } from "@/components/registrar-consulta";
import { WhatsAppRowButton } from "@/components/busca/whatsapp-row-button";
import { AdicionarOrcamentoButton } from "@/components/busca/adicionar-orcamento-button";
import { AtalhosBusca } from "@/components/busca/atalhos-busca";
import { buildContatoLojaUrl } from "@/lib/whatsapp";
import { buscarProdutos } from "@/lib/busca-produtos";
import { listarAgregadosPorProdutos } from "@/lib/agregados";
import { AgregadosBuscaRow } from "@/components/agregados/agregados-busca-row";
import { codigoExibicao, labelMatchTipo, tituloExibicao } from "@/lib/produto-campos";

const POR_PAGINA = 25;
const MAX_CHIPS_REFERENCIA = 3;

function ReferenciaChips({
  refs,
  numeroProduto,
}: {
  refs: string[];
  numeroProduto?: string | null;
}) {
  if (refs.length > 0) {
    const visiveis = refs.slice(0, MAX_CHIPS_REFERENCIA);
    const restantes = refs.length - visiveis.length;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {visiveis.map((r) => (
          <span
            key={r}
            className="inline-flex items-center rounded border border-outline-variant bg-surface px-1.5 py-0.5 font-mono text-[11px] leading-4 text-on-surface-variant"
          >
            {r}
          </span>
        ))}
        {restantes > 0 && (
          <span className="text-label-sm text-on-surface-variant">+{restantes}</span>
        )}
      </div>
    );
  }
  if (numeroProduto) {
    return (
      <span className="inline-flex items-center rounded border border-outline-variant bg-surface px-1.5 py-0.5 font-mono text-[11px] leading-4 text-on-surface-variant">
        {numeroProduto}
      </span>
    );
  }
  return <span className="text-label-sm text-outline">Sem referências</span>;
}

function sanitize(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}

function apenasCodigo(q: string) {
  return q.replace(/[\s./-]/g, "");
}

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; catalogo?: string; foto?: string; ordem?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const q = sanitize(params.q ?? "");
  const qCodigo = apenasCodigo(q);
  const catalogo = params.catalogo ?? "";
  const comFoto = params.foto === "1";
  const ordem = params.ordem ?? "relevancia";
  const pagina = Math.max(1, parseInt(params.pagina ?? "1", 10) || 1);

  const supabase = await createClient();

  const { data: catalogos } = await supabase
    .from("catalogos")
    .select("slug, nome_exibicao")
    .eq("status", "ok")
    .order("produtos_count", { ascending: false })
    .limit(6);

  const { produtos, total } = await buscarProdutos({
    q,
    catalogo,
    comFoto,
    pagina,
    limite: POR_PAGINA,
  });

  const produtosOrdenados =
    ordem === "codigo"
      ? [...produtos].sort((a, b) =>
          codigoExibicao(a).localeCompare(codigoExibicao(b), "pt-BR")
        )
      : produtos;

  const agregadosPorProduto = await listarAgregadosPorProdutos(
    produtosOrdenados.map((p) => p.id)
  );

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
      <AtalhosBusca targetId="busca-input" />
      {q && <RegistrarConsulta termo={q} />}

      <div className="flex flex-col gap-4">
        <form
          action="/busca"
          className="flex items-center gap-3 rounded-xl bg-surface-container-lowest p-1.5 shadow-sm ring-1 ring-outline-variant transition-shadow focus-within:ring-2 focus-within:ring-primary"
        >
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              id="busca-input"
              type="text"
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="Buscar por código, descrição ou referência..."
              className="w-full bg-transparent text-body-lg text-on-surface placeholder:text-outline py-2.5 pl-12 pr-12 focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center rounded border border-outline-variant bg-surface-container px-1.5 py-0.5 font-mono text-[11px] leading-none text-on-surface-variant sm:inline-flex">
              /
            </kbd>
          </div>
          {catalogo && <input type="hidden" name="catalogo" value={catalogo} />}
          <button
            type="submit"
            className="bg-primary text-on-primary hover:bg-primary-container px-6 py-3 rounded-lg flex items-center gap-2 text-label-sm uppercase transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined">search</span>
            <span className="hidden sm:inline">Buscar</span>
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
            <span className="text-label-sm text-on-surface-variant">Ordenar:</span>
            <Link
              href={buildUrl({ ordem: ordem === "codigo" ? undefined : "codigo" })}
              className="inline-flex items-center gap-1 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface py-1.5 px-3 hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {ordem === "codigo" ? "Código A–Z ✓" : "Relevância"}
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        {produtosOrdenados.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-high border-b border-outline-variant text-on-surface-variant text-label-sm tracking-wide">
              <tr>
                <th className="px-3 py-3 w-14 text-center font-semibold">Foto</th>
                <th className="px-3 py-3 font-semibold">Peça</th>
                <th className="px-3 py-3 w-56 hidden md:table-cell font-semibold">Aplicação / referências</th>
                <th className="px-3 py-3 w-32 hidden sm:table-cell font-semibold">Catálogo</th>
                <th className="px-3 py-3 w-px text-right whitespace-nowrap font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="text-body-md text-on-surface">
              {produtosOrdenados.map((p, i) => {
                const refs = p.referencias;
                const titulo = tituloExibicao(p);
                const codigo = codigoExibicao(p);
                const matchLabel = labelMatchTipo(p.match_tipo);
                const descricaoParaAcao = p.descricao ?? titulo;
                const agregados = agregadosPorProduto.get(p.id) ?? [];

                return (
                  <tr
                    key={p.id}
                    className={`border-b border-outline-variant hover:bg-primary-fixed/40 transition-colors align-top ${
                      i % 2 === 1 ? "bg-surface-container-low" : "bg-surface-container-lowest"
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center">
                      {p.foto_url ? (
                        <div className="w-11 h-11 bg-white border border-outline-variant rounded flex items-center justify-center overflow-hidden shrink-0 mx-auto">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.foto_url}
                            alt={titulo}
                            className="w-10 h-10 object-contain"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div
                          className="w-11 h-11 bg-surface-container-low rounded flex items-center justify-center shrink-0 mx-auto text-outline-variant"
                          aria-hidden="true"
                        >
                          <span className="material-symbols-outlined text-[18px] opacity-60">
                            image
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/produtos/${p.id}`}
                        title={p.descricao_original ?? p.descricao ?? undefined}
                        className="font-semibold text-on-surface hover:text-primary hover:underline line-clamp-2"
                      >
                        {titulo}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        <span className="font-mono text-code-md text-primary">{codigo}</span>
                        {matchLabel && (
                          <span className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                            {matchLabel}
                          </span>
                        )}
                      </div>
                      <AgregadosBuscaRow
                        agregados={agregados}
                        principal={{
                          produtoId: p.id,
                          codigo,
                          descricao: descricaoParaAcao,
                          fabricante: p.fabricante,
                          fotoUrl: p.foto_url,
                        }}
                      />
                      <div className="md:hidden mt-1.5">
                        <ReferenciaChips refs={refs} numeroProduto={p.numero_produto} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <ReferenciaChips refs={refs} numeroProduto={p.numero_produto} />
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-outline-variant bg-surface text-label-sm text-on-surface-variant uppercase">
                        <span className="w-2 h-2 rounded-full bg-secondary-fixed" />
                        {p.origem_catalogo}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <AdicionarOrcamentoButton
                          item={{
                            produtoId: p.id,
                            codigo,
                            descricao: descricaoParaAcao,
                            fabricante: p.fabricante ?? undefined,
                            fotoUrl: p.foto_url,
                          }}
                        />
                        <WhatsAppRowButton
                          produto={{
                            descricao: descricaoParaAcao,
                            codigo,
                            numeroProduto: p.numero_produto,
                            fabricante: p.fabricante ?? undefined,
                            catalogo: p.origem_catalogo,
                            fotoUrl: p.foto_url,
                          }}
                        />
                        <Link
                          href={`/produtos/${p.id}`}
                          className="w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant hover:bg-primary hover:text-on-primary transition-colors flex items-center justify-center border border-transparent hover:border-primary shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Ver detalhes"
                          aria-label="Ver detalhes do produto"
                        >
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 px-6 flex flex-col items-center justify-center text-center gap-3">
            <span className="material-symbols-outlined text-outline text-5xl">search_off</span>
            <p className="text-headline-sm text-on-surface">
              Nenhuma peça encontrada{q ? <> para “{q}”</> : ""}
            </p>
            <div className="text-body-md text-on-surface-variant max-w-md space-y-2">
              <p>Tente uma destas opções:</p>
              <ul className="flex flex-col gap-2">
                {qCodigo && qCodigo !== q && (
                  <li>
                    <Link
                      href={buildUrl({ q: qCodigo, catalogo: undefined })}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <span className="material-symbols-outlined text-[18px]">backspace</span>
                      Buscar sem hífens/pontos: <span className="font-mono">{qCodigo}</span>
                    </Link>
                  </li>
                )}
                {catalogo && (
                  <li>
                    <Link
                      href={buildUrl({ catalogo: undefined })}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                      Buscar em todos os catálogos
                    </Link>
                  </li>
                )}
                <li className="text-on-surface-variant">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                    Digite apenas o código principal, sem a marca.
                  </span>
                </li>
                <li>
                  <a
                    href={buildContatoLojaUrl(
                      null,
                      q ? `Olá, não encontrei a peça "${q}" no catálogo. Pode ajudar?` : undefined
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <span className="material-symbols-outlined text-[18px]">support_agent</span>
                    Pedir ajuda no WhatsApp do suporte
                  </a>
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="bg-surface-container-low border-t border-outline-variant px-4 py-3 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <span className="text-body-md text-on-surface-variant">
            Mostrando{" "}
            <span className="font-bold text-on-surface">
              {total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1}–
              {Math.min(pagina * POR_PAGINA, total)}
            </span>{" "}
            de <span className="font-bold text-on-surface">{total}</span>
          </span>
          <div className="flex items-center gap-2">
            {pagina > 1 ? (
              <Link
                href={buildUrl({ pagina: String(pagina - 1) })}
                className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-sm uppercase text-on-surface hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                Anterior
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-sm uppercase text-outline opacity-50 cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                Anterior
              </span>
            )}
            <span className="px-2 text-label-sm font-medium text-on-surface-variant whitespace-nowrap">
              Página <span className="font-bold text-on-surface">{pagina}</span> de{" "}
              <span className="font-bold text-on-surface">{totalPaginas}</span>
            </span>
            {pagina < totalPaginas ? (
              <Link
                href={buildUrl({ pagina: String(pagina + 1) })}
                className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-sm uppercase text-on-surface hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Próxima
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-sm uppercase text-outline opacity-50 cursor-not-allowed"
              >
                Próxima
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
