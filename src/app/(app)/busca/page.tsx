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
import {
  codigoExibicao,
  labelMatchTipo,
  normalizarCodigo,
  tituloExibicao,
} from "@/lib/produto-campos";

const POR_PAGINA = 25;
const MAX_CHIPS_REFERENCIA = 3;

function ReferenciaChips({
  refs,
  numeroProduto,
  matchValor,
}: {
  refs: string[];
  numeroProduto?: string | null;
  matchValor?: string | null;
}) {
  if (refs.length > 0) {
    const matchNormalizado = matchValor ? normalizarCodigo(matchValor) : "";
    const casaComMatch = (r: string) =>
      Boolean(matchNormalizado) && normalizarCodigo(r).includes(matchNormalizado);
    // Referência que casou vem primeiro para não ficar escondida no "+N"
    const ordenadas = matchNormalizado
      ? [...refs].sort((a, b) => Number(casaComMatch(b)) - Number(casaComMatch(a)))
      : refs;
    const visiveis = ordenadas.slice(0, MAX_CHIPS_REFERENCIA);
    const restantes = ordenadas.length - visiveis.length;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {visiveis.map((r) =>
          casaComMatch(r) ? (
            <span
              key={r}
              className="inline-flex items-center rounded border border-primary bg-primary-container px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-4 text-on-primary-container"
            >
              {r}
            </span>
          ) : (
            <span
              key={r}
              className="inline-flex items-center rounded border border-outline-variant bg-surface px-1.5 py-0.5 font-mono text-[11px] leading-4 text-on-surface-variant"
            >
              {r}
            </span>
          )
        )}
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
  searchParams: Promise<{
    q?: string;
    catalogo?: string;
    foto?: string;
    ordem?: string;
    pagina?: string;
    fonte?: string;
  }>;
}) {
  const params = await searchParams;
  const q = sanitize(params.q ?? "");
  const qCodigo = apenasCodigo(q);
  const catalogo = params.catalogo ?? "";
  const comFoto = params.foto === "1";
  const ordem = params.ordem ?? "relevancia";
  const pagina = Math.max(1, parseInt(params.pagina ?? "1", 10) || 1);
  const fonteParam = params.fonte;
  const fonte =
    fonteParam === "local" || fonteParam === "tecdoc" || fonteParam === "todos"
      ? fonteParam
      : "todos";

  const supabase = await createClient();

  const { data: catalogosTop } = await supabase
    .from("catalogos")
    .select("slug, nome_exibicao")
    .eq("status", "ok")
    .order("produtos_count", { ascending: false })
    .limit(6);

  let catalogos = catalogosTop ?? [];
  // Garante que o catálogo filtrado apareça nos chips (mesmo fora do top 6)
  if (catalogo && !catalogos.some((c) => c.slug === catalogo)) {
    const { data: selecionado } = await supabase
      .from("catalogos")
      .select("slug, nome_exibicao")
      .eq("slug", catalogo)
      .maybeSingle();
    if (selecionado) catalogos = [selecionado, ...catalogos];
  }

  const { produtos, totalLocal, totalTecdoc } = await buscarProdutos({
    q,
    catalogo,
    comFoto,
    pagina,
    limite: POR_PAGINA,
    fonte,
  });

  const produtosOrdenados =
    ordem === "codigo"
      ? [...produtos].sort((a, b) =>
          codigoExibicao(a).localeCompare(codigoExibicao(b), "pt-BR")
        )
      : produtos;

  // Agregados só para produtos locais (ids positivos do Supabase)
  const idsLocais = produtosOrdenados.filter((p) => p.fonte === "local").map((p) => p.id);
  const agregadosPorProduto = await listarAgregadosPorProdutos(idsLocais);

  // Paginação considera apenas o total local; TecDoc é complemento da página atual
  const totalPaginas = Math.max(1, Math.ceil(Math.max(totalLocal, 1) / POR_PAGINA));
  const nomeCatalogoAtivo =
    catalogos.find((c) => c.slug === catalogo)?.nome_exibicao ?? catalogo;

  const buildUrl = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = {
      q,
      catalogo,
      foto: comFoto ? "1" : undefined,
      ordem,
      fonte: fonte === "todos" ? undefined : fonte,
      pagina: undefined,
      ...patch,
    };
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
            {!catalogo && (
              <>
                <Link
                  href={buildUrl({ fonte: undefined })}
                  className={
                    fonte === "todos"
                      ? "bg-primary-container text-on-primary-container border border-primary px-2.5 py-1 rounded-full text-label-sm"
                      : "bg-surface-container-lowest border border-outline-variant px-2.5 py-1 rounded-full text-label-sm text-on-surface-variant hover:border-primary"
                  }
                >
                  Todos
                </Link>
                <Link
                  href={buildUrl({ fonte: "local" })}
                  className={
                    fonte === "local"
                      ? "bg-primary-container text-on-primary-container border border-primary px-2.5 py-1 rounded-full text-label-sm"
                      : "bg-surface-container-lowest border border-outline-variant px-2.5 py-1 rounded-full text-label-sm text-on-surface-variant hover:border-primary"
                  }
                >
                  Local
                </Link>
                <Link
                  href={buildUrl({ fonte: "tecdoc" })}
                  className={
                    fonte === "tecdoc"
                      ? "bg-primary-container text-on-primary-container border border-primary px-2.5 py-1 rounded-full text-label-sm"
                      : "bg-surface-container-lowest border border-outline-variant px-2.5 py-1 rounded-full text-label-sm text-on-surface-variant hover:border-primary"
                  }
                >
                  TecDoc
                </Link>
              </>
            )}
            <span className="text-label-sm text-on-surface-variant">Ordenar:</span>
            <Link
              href={buildUrl({ ordem: ordem === "codigo" ? undefined : "codigo" })}
              className="inline-flex items-center gap-1 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface py-1.5 px-3 hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {ordem === "codigo" ? "Código A–Z ✓" : "Relevância"}
            </Link>
          </div>
        </div>
        {catalogo && (
          <p className="text-body-md text-on-surface-variant">
            Exibindo produtos do catálogo{" "}
            <span className="font-semibold text-on-surface">{nomeCatalogoAtivo}</span>
            {totalLocal > 0 && (
              <>
                {" "}
                · <span className="font-mono font-semibold text-on-surface">{totalLocal.toLocaleString("pt-BR")}</span>{" "}
                itens
              </>
            )}
          </p>
        )}
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
                const isTecDoc = p.fonte === "tecdoc";
                const refs = p.referencias;
                const titulo = tituloExibicao(p);
                const codigo = codigoExibicao(p);
                const matchLabel = labelMatchTipo(p.match_tipo);
                const matchNoCodigo =
                  !isTecDoc &&
                  (p.match_tipo === "codigo_exato" || p.match_tipo === "codigo_normalizado") &&
                  Boolean(p.match_valor) &&
                  normalizarCodigo(p.match_valor) === normalizarCodigo(codigo);
                const matchNaReferencia =
                  p.match_tipo === "referencia_exata" || p.match_tipo === "referencia_normalizada";
                const matchValorRef = matchNaReferencia ? p.match_valor : null;
                const descricaoParaAcao = p.descricao ?? titulo;
                const agregados = isTecDoc ? [] : (agregadosPorProduto.get(p.id) ?? []);
                const detalheHref = isTecDoc
                  ? `/produtos/tecdoc/${p.articleId}`
                  : `/produtos/${p.id}`;
                const rowKey = isTecDoc ? `tecdoc-${p.articleId}` : `local-${p.id}`;

                return (
                  <tr
                    key={rowKey}
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
                        href={detalheHref}
                        title={p.descricao_original ?? p.descricao ?? undefined}
                        className="font-semibold text-on-surface hover:text-primary hover:underline line-clamp-2"
                      >
                        {titulo}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        <span
                          className={
                            matchNoCodigo
                              ? "font-mono text-code-md font-semibold text-on-primary-container bg-primary-container rounded px-1"
                              : "font-mono text-code-md text-primary"
                          }
                        >
                          {codigo}
                        </span>
                        {matchLabel && !isTecDoc && (
                          <span className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                            {matchLabel}
                          </span>
                        )}
                      </div>
                      {p.aplicacao_resumo && (
                        <p className="mt-0.5 line-clamp-1 text-label-sm text-on-surface-variant">
                          {p.aplicacao_resumo}
                        </p>
                      )}
                      {!isTecDoc && (
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
                      )}
                      <div className="md:hidden mt-1.5">
                        {isTecDoc ? (
                          <span className="text-label-sm text-on-surface-variant line-clamp-2">
                            {p.aplicacao_resumo ?? "Catálogo TecDoc"}
                          </span>
                        ) : (
                          <ReferenciaChips
                            refs={refs}
                            numeroProduto={p.numero_produto}
                            matchValor={matchValorRef}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      {isTecDoc ? (
                        <span className="text-label-sm text-on-surface-variant line-clamp-3">
                          {p.aplicacao_resumo ?? "—"}
                        </span>
                      ) : (
                        <ReferenciaChips
                          refs={refs}
                          numeroProduto={p.numero_produto}
                          matchValor={matchValorRef}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      {isTecDoc ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-primary/40 bg-primary-container/40 text-label-sm text-on-primary-container uppercase font-semibold">
                          <span className="w-2 h-2 rounded-full bg-primary" />
                          TecDoc
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-outline-variant bg-surface text-label-sm text-on-surface-variant uppercase">
                          <span className="w-2 h-2 rounded-full bg-secondary-fixed" />
                          {p.origem_catalogo}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <AdicionarOrcamentoButton
                          item={{
                            produtoId: isTecDoc ? null : p.id,
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
                            catalogo: isTecDoc ? "TecDoc" : p.origem_catalogo,
                            fotoUrl: p.foto_url,
                          }}
                        />
                        <Link
                          href={detalheHref}
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
              {totalLocal === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1}–
              {Math.min(pagina * POR_PAGINA, totalLocal)}
            </span>{" "}
            de <span className="font-bold text-on-surface">{totalLocal}</span>
            {totalTecdoc > 0 && (
              <>
                {" "}
                · <span className="font-bold text-primary">{totalTecdoc}</span> TecDoc
              </>
            )}
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
