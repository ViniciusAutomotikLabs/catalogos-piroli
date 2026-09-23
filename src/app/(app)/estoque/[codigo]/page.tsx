import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModulo } from "@/lib/loja";
import {
  atualizarEspelhoIdentidade,
  buscarEspelhoPorCodigo,
  buscarEspelhoPorCodigos,
  listarAgregadosEspelhoPorCodigos,
} from "@/lib/espelho";
import { enrichEspelhoPeca } from "@/lib/gpasi-peca";
import { AdicionarOrcamentoButton } from "@/components/busca/adicionar-orcamento-button";
import { CodigoChip } from "@/components/produto/codigo-chip";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatQtd(v: number) {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export default async function EstoquePecaPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  await requireModulo("estoque");
  const { codigo: raw } = await params;
  const codigo = decodeURIComponent(raw ?? "").trim();
  if (!codigo) notFound();

  const item = await buscarEspelhoPorCodigo(codigo);
  if (!item) notFound();

  const [{ dados, filiais, similares }, agregadosMap] = await Promise.all([
    enrichEspelhoPeca(codigo),
    listarAgregadosEspelhoPorCodigos([codigo]),
  ]);

  // Ordem SS: interno → fabricante → marca → descrição
  const fab =
    dados?.codigoFabricante?.trim() ||
    item.codigoFabricante?.trim() ||
    null;
  const marca = dados?.marca?.trim() || item.marca?.trim() || null;
  const descricao =
    dados?.descricao?.trim() || item.descricao?.trim() || codigo;

  const empresaAtual = process.env.GPASI_EMPRESA?.trim() || "0001";
  const totalFiliais = filiais.reduce((acc, f) => acc + f.estoque, 0);
  const totalReservadoFiliais = filiais.reduce((acc, f) => acc + f.reservado, 0);
  const filialAtual = filiais.find((f) => f.empresa === empresaAtual);
  const temSaldoLive = filiais.length > 0;
  // Rede = soma das filiais (fonte de verdade na ficha). Espelho local pode estar velho.
  const disponivelRede = temSaldoLive ? totalFiliais : item.disponivel;
  const disponivelLoja = temSaldoLive
    ? (filialAtual?.estoque ?? 0) - (filialAtual?.reservado ?? 0)
    : item.disponivel;
  const reservadoLoja = temSaldoLive
    ? (filialAtual?.reservado ?? 0)
    : item.reservado;

  if (
    dados &&
    (fab || marca || dados.descricao || temSaldoLive)
  ) {
    void atualizarEspelhoIdentidade(codigo, {
      codigoFabricante: fab,
      marca,
      descricao: dados.descricao,
      // Espelho = saldo desta loja (empresa atual), não a soma da rede
      quantidade: temSaldoLive ? (filialAtual?.estoque ?? 0) : undefined,
      reservado: temSaldoLive ? (filialAtual?.reservado ?? 0) : undefined,
    });
  }

  const agregados = agregadosMap.get(codigo) ?? [];
  const aplicacao = dados?.aplicacao?.trim() || null;
  const aplicacaoResumo = aplicacao
    ? aplicacao
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(" · ")
    : null;

  const similaresCodigos = similares.map((s) => s.codigo);
  const espelhoSimilares = await buscarEspelhoPorCodigos(similaresCodigos);

  return (
    <div className="space-y-6 max-w-6xl pb-24 lg:pb-6">
      <nav className="flex flex-wrap items-center gap-2 text-body-md text-on-surface-variant">
        <Link href="/estoque" className="hover:text-primary">
          Estoque
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="font-mono text-on-surface">{codigo}</span>
        {fab ? (
          <>
            <span className="text-outline">·</span>
            <span className="font-mono text-on-surface">{fab}</span>
          </>
        ) : null}
      </nav>

      {/* Hero */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
          <div className="lg:col-span-2 bg-white border-b lg:border-b-0 lg:border-r border-outline-variant flex items-center justify-center p-6 min-h-[220px]">
            <div className="flex flex-col items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[64px] text-outline">
                image_not_supported
              </span>
              <span className="text-label-sm">Foto não disponível via API</span>
            </div>
          </div>

          <div className="lg:col-span-3 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                  Produto · espelho SS Plus
                </p>
                <h1 className="text-headline-md font-bold text-on-surface tracking-tight">
                  {descricao}
                </h1>
              </div>
              <AdicionarOrcamentoButton
                item={{
                  produtoId: item.produtoId,
                  codigo: item.codigo,
                  descricao,
                  precoUnitario: item.preco,
                }}
              />
            </div>

            {/* Identidade na ordem da SS */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-outline-variant bg-surface-container-low/60 p-3">
              <div className="min-w-0">
                <dt className="text-label-sm text-on-surface-variant">
                  Código interno (SS)
                </dt>
                <dd className="mt-0.5">
                  <CodigoChip label="Interno" value={codigo} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label-sm text-on-surface-variant">
                  Código fabricante
                </dt>
                <dd className="mt-0.5">
                  {fab ? (
                    <CodigoChip label="Fabricante" value={fab} />
                  ) : (
                    <span className="text-body-md text-on-surface-variant">
                      Indisponível
                    </span>
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label-sm text-on-surface-variant">
                  Descrição marca
                </dt>
                <dd className="mt-0.5 text-body-lg font-semibold text-on-surface uppercase tracking-wide">
                  {marca ?? "—"}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-label-sm text-on-surface-variant">
                  Descrição
                </dt>
                <dd className="mt-0.5 text-body-md text-on-surface">{descricao}</dd>
              </div>
            </dl>

            {aplicacaoResumo && (
              <div>
                <p className="text-label-sm text-on-surface-variant mb-0.5">
                  Aplicação
                </p>
                <p className="text-body-md text-on-surface line-clamp-3">
                  {aplicacaoResumo}
                </p>
              </div>
            )}

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <dt className="text-label-sm text-on-surface-variant">
                  Rede (filiais)
                </dt>
                <dd className="text-headline-sm font-bold text-on-surface tabular-nums">
                  {formatQtd(disponivelRede)}
                </dd>
              </div>
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <dt className="text-label-sm text-on-surface-variant">
                  Esta loja
                </dt>
                <dd className="text-headline-sm font-semibold text-on-surface tabular-nums">
                  {formatQtd(disponivelLoja)}
                </dd>
              </div>
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <dt className="text-label-sm text-on-surface-variant">Preço</dt>
                <dd className="text-headline-sm font-bold text-on-surface">
                  {formatBRL(item.preco)}
                </dd>
              </div>
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <dt className="text-label-sm text-on-surface-variant">Atacado</dt>
                <dd className="text-headline-sm font-semibold text-on-surface">
                  {item.precoAtacado != null
                    ? formatBRL(item.precoAtacado)
                    : "—"}
                </dd>
              </div>
            </dl>
            {temSaldoLive && totalReservadoFiliais > 0 && (
              <p className="text-label-sm text-on-surface-variant">
                Reservado na rede ·{" "}
                <span className="tabular-nums font-medium text-on-surface">
                  {formatQtd(totalReservadoFiliais)}
                </span>
                {reservadoLoja > 0 ? (
                  <>
                    {" "}
                    · nesta loja ·{" "}
                    <span className="tabular-nums">{formatQtd(reservadoLoja)}</span>
                  </>
                ) : null}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {fab ? (
                <Link
                  href={`/busca?q=${encodeURIComponent(fab)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-label-sm uppercase text-on-primary hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    search
                  </span>
                  Buscar no catálogo
                </Link>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-4 py-2.5 text-label-sm uppercase text-on-surface-variant cursor-not-allowed"
                  title="Sem código fabricante — não é possível localizar no catálogo"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    search_off
                  </span>
                  Buscar no catálogo
                </span>
              )}
              {item.produtoId ? (
                <Link
                  href={`/produtos/${item.produtoId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-4 py-2.5 text-label-sm uppercase hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    menu_book
                  </span>
                  Ficha do catálogo
                </Link>
              ) : null}
            </div>
            {fab ? (
              <p className="text-label-sm text-on-surface-variant">
                Catálogo busca pelo código fabricante{" "}
                <span className="font-mono text-on-surface">{fab}</span>
                {" · "}não pelo interno SS{" "}
                <span className="font-mono">{codigo}</span>
              </p>
            ) : (
              <p className="text-label-sm text-error">
                Código fabricante não encontrado na GPASI — a busca no catálogo
                fica desabilitada para não usar o código interno SS.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Saldo Filiais */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant px-4 py-3">
          <span className="material-symbols-outlined text-[20px] text-outline">
            store
          </span>
          <h2 className="text-title-md font-semibold text-on-surface">
            Saldo Filiais
          </h2>
          <span className="ml-auto text-body-md text-on-surface">
            TOTAL{" "}
            <strong className="tabular-nums font-bold">
              {formatQtd(totalFiliais)}
            </strong>
          </span>
        </div>
        {filiais.length === 0 ? (
          <p className="px-4 py-6 text-body-md text-on-surface-variant">
            Sem saldos por filial no momento (GPASI indisponível ou credenciais
            ausentes).
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {filiais.map((f) => {
              const tem = f.estoque > 0;
              const atual = f.empresa === empresaAtual;
              return (
                <li
                  key={f.empresa}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                    tem ? "bg-primary-fixed/40" : ""
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-mono text-code-md text-on-surface shrink-0">
                      {f.empresa}
                    </span>
                    <span
                      className={`truncate text-body-md ${
                        tem
                          ? "text-on-surface font-medium"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {f.fantasia ?? `Empresa ${f.empresa}`}
                    </span>
                    {atual && (
                      <span className="shrink-0 rounded border border-primary/40 bg-primary-container/40 px-1.5 py-0.5 text-[10px] uppercase text-on-primary-container">
                        Esta loja
                      </span>
                    )}
                  </div>
                  <span
                    className={`tabular-nums shrink-0 ${
                      tem
                        ? "font-bold text-on-surface text-body-lg"
                        : "font-medium text-on-surface-variant"
                    }`}
                  >
                    {formatQtd(f.estoque)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Agregados */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden">
        <h2 className="flex items-center gap-2 border-b border-outline-variant px-4 py-3 text-title-md font-semibold text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-outline">
            construction
          </span>
          Agregados de montagem
          {agregados.length > 0 && (
            <span className="ml-auto inline-flex min-w-6 h-6 items-center justify-center rounded-full bg-primary-container px-1.5 text-label-sm text-on-primary-container">
              {agregados.length}
            </span>
          )}
        </h2>
        {agregados.length === 0 ? (
          <p className="px-4 py-8 text-center text-body-md text-on-surface-variant">
            Nenhum agregado cadastrado na SS para este código.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {agregados.map((a) => (
              <li
                key={a.codigoAgregado}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/estoque/${encodeURIComponent(a.codigoAgregado)}`}
                    className="font-medium text-on-surface hover:text-primary hover:underline line-clamp-1"
                  >
                    {a.descricao ?? a.codigoAgregado}
                  </Link>
                  <p className="font-mono text-code-md text-primary">
                    {a.codigoAgregado}
                  </p>
                </div>
                <div className="shrink-0 text-right text-body-md">
                  <p className="font-semibold tabular-nums">
                    {formatQtd(a.quantidade)}
                  </p>
                  <p className="text-on-surface-variant">
                    {formatBRL(a.preco)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Similares — colunas no estilo SS */}
      {similares.length > 0 && (
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-outline-variant px-4 py-3 text-title-md font-semibold text-on-surface">
            <span className="material-symbols-outlined text-[20px] text-outline">
              swap_horiz
            </span>
            Similares
            <span className="ml-auto inline-flex min-w-6 h-6 items-center justify-center rounded-full bg-surface-container-high px-1.5 text-label-sm text-on-surface-variant">
              {similares.length}
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead className="bg-surface-container-high text-label-sm text-on-surface-variant">
                <tr>
                  <th className="px-4 py-2 font-semibold">Código interno</th>
                  <th className="px-4 py-2 font-semibold">Cód. fabricante</th>
                  <th className="px-4 py-2 font-semibold">Marca</th>
                  <th className="px-4 py-2 font-semibold">Descrição</th>
                  <th className="px-4 py-2 font-semibold text-right">Estoque</th>
                  <th className="px-4 py-2 font-semibold text-right">Preço</th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {similares.map((s) => {
                  const esp = espelhoSimilares.get(s.codigo);
                  const atual = s.codigo === codigo;
                  const fabSim =
                    atual && fab
                      ? fab
                      : esp?.codigoFabricante ?? null;
                  return (
                    <tr
                      key={s.codigo}
                      className={`border-t border-outline-variant ${
                        atual
                          ? "bg-primary-fixed/50"
                          : "hover:bg-primary-fixed/30"
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        {atual ? (
                          <span className="font-mono text-code-md text-on-surface">
                            {s.codigo}
                            <span className="ml-2 text-[10px] uppercase text-primary">
                              Esta peça
                            </span>
                          </span>
                        ) : (
                          <Link
                            href={`/estoque/${encodeURIComponent(s.codigo)}`}
                            className="font-mono text-code-md text-primary hover:underline"
                          >
                            {s.codigo}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-code-md text-on-surface">
                        {fabSim ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 uppercase text-on-surface">
                        {atual ? marca ?? "—" : esp?.marca ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 max-w-md">
                        <span className="line-clamp-2">{s.descricao}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {esp ? formatQtd(esp.disponivel) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {esp ? formatBRL(esp.preco) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Detalhes técnicos */}
      {(aplicacao ||
        (dados?.caracteristicas && dados.caracteristicas.length > 0) ||
        dados?.ncm ||
        dados?.grupo) && (
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden">
          <h2 className="border-b border-outline-variant px-4 py-3 text-title-md font-semibold text-on-surface">
            Detalhes técnicos
          </h2>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {aplicacao && (
              <div className="sm:col-span-2">
                <h3 className="text-label-sm uppercase tracking-wide text-on-surface-variant mb-1">
                  Aplicação
                </h3>
                <pre className="whitespace-pre-wrap font-sans text-body-md text-on-surface bg-surface-container-low rounded-lg px-3 py-2">
                  {aplicacao}
                </pre>
              </div>
            )}
            {dados?.caracteristicas && dados.caracteristicas.length > 0 && (
              <div>
                <h3 className="text-label-sm uppercase tracking-wide text-on-surface-variant mb-1">
                  Características
                </h3>
                <ul className="list-disc pl-5 text-body-md text-on-surface space-y-0.5">
                  {dados.caracteristicas.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2 text-body-md">
              {dados?.grupo && (
                <p>
                  <span className="text-on-surface-variant">Grupo · </span>
                  <span className="font-mono">{dados.grupo}</span>
                  {dados.secao ? (
                    <>
                      <span className="text-on-surface-variant"> · Seção · </span>
                      <span className="font-mono">{dados.secao}</span>
                    </>
                  ) : null}
                </p>
              )}
              {dados?.ncm && (
                <p>
                  <span className="text-on-surface-variant">NCM · </span>
                  <span className="font-mono">{dados.ncm}</span>
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Mobile sticky actions */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-outline-variant bg-surface-container-lowest/95 backdrop-blur px-4 py-3 flex gap-2">
        {fab ? (
          <Link
            href={`/busca?q=${encodeURIComponent(fab)}`}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary py-3 text-label-sm uppercase text-on-primary"
          >
            Buscar no catálogo
          </Link>
        ) : (
          <span className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-surface-container-high py-3 text-label-sm uppercase text-on-surface-variant">
            Sem cód. fabricante
          </span>
        )}
      </div>
    </div>
  );
}
