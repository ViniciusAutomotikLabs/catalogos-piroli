import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";
import { RegistrarConsulta } from "@/components/registrar-consulta";
import { ProdutoAcoes } from "@/components/produto/acoes";
import { CodigoChip } from "@/components/produto/codigo-chip";
import {
  codigoExibicao,
  descricaoOriginalExibicao,
  parseDescricaoComFallback,
  tituloExibicao,
} from "@/lib/produto-campos";
import { listarAgregadosDoProduto, mapEspelhoAgregadosParaItens } from "@/lib/agregados";
import { AdicionarAgregadosButton } from "@/components/agregados/adicionar-agregados-button";
import {
  buscarEspelhoPorCodigos,
  buscarEspelhoPorProdutoIds,
  listarAgregadosEspelhoPorCodigos,
} from "@/lib/espelho";

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const produtoId = parseInt(id, 10);
  if (Number.isNaN(produtoId)) notFound();

  const supabase = await createClient();
  const contexto = await getContextoLoja();

  const { data: produto } = await supabase
    .from("produtos")
    .select(
      "id, codigo_produto_interno, codigo_principal, numero_produto, descricao, descricao_original, titulo_normalizado, codigos_extraidos, medidas_extraidas, aplicacao_resumo, normalizacao_status, unidade, foto_url, observacoes, origem_catalogo, fabricantes(nome_fabricante), referencias_cruzadas(id, numero_referencia, fabricante_referencia)"
    )
    .eq("id", produtoId)
    .maybeSingle();

  if (!produto) notFound();

  const { data: catalogoInfo } = await supabase
    .from("catalogos")
    .select("nome_exibicao")
    .eq("slug", produto.origem_catalogo)
    .maybeSingle();

  const nomeCatalogo = catalogoInfo?.nome_exibicao ?? produto.origem_catalogo;
  const fabricante = produto.fabricantes?.nome_fabricante ?? null;
  const desc = parseDescricaoComFallback(produto);
  const titulo = tituloExibicao(produto);
  const codigo = codigoExibicao(produto);
  const textoOriginal = descricaoOriginalExibicao(produto);
  const codigosExtra =
    produto.codigos_extraidos?.length ? produto.codigos_extraidos : desc.codigos;
  const medidas = produto.medidas_extraidas ?? [];
  const manuais = await listarAgregadosDoProduto(produto.id);
  const espelhoMap = await buscarEspelhoPorProdutoIds([produto.id]);
  const espelho =
    espelhoMap.get(produto.id) ??
    (await buscarEspelhoPorCodigos([codigo])).get(codigo);
  const codigoEspelho = espelho?.codigo ?? codigo;
  const doSsMap = await listarAgregadosEspelhoPorCodigos([codigoEspelho]);
  const doSs = mapEspelhoAgregadosParaItens(
    codigoEspelho,
    doSsMap.get(codigoEspelho) ?? [],
    produto.id
  );
  const vistos = new Set(manuais.map((a) => a.codigo));
  const agregados = [...manuais, ...doSs.filter((a) => !vistos.has(a.codigo))];

  return (
    <div className="pb-24">
      <RegistrarConsulta termo={null} produtoId={produto.id} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-body-md text-on-surface-variant mb-6">
        <Link href="/inicio" className="hover:text-primary hover:underline">
          Início
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/busca" className="hover:text-primary hover:underline">
          Busca
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold line-clamp-1">
          {desc.alterado || produto.titulo_normalizado ? titulo : codigo}
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Foto */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-outline-variant rounded-xl p-4 flex items-center justify-center aspect-[4/3] sticky top-24 shadow-sm">
            {produto.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={produto.foto_url}
                alt={produto.descricao ?? ""}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-outline">
                <span className="material-symbols-outlined text-6xl">image_not_supported</span>
                <span className="text-body-md">Sem imagem neste catálogo</span>
              </div>
            )}
          </div>
          {produto.foto_url && (
            <div className="flex gap-2 mt-3">
              <a
                href={produto.foto_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase"
              >
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                Ampliar
              </a>
              <a
                href={produto.foto_url}
                download
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Baixar
              </a>
            </div>
          )}
        </div>

        {/* Dados */}
        <div className="lg:col-span-3 space-y-6">
          <div>
            <h1 className="text-headline-lg text-on-surface">{titulo}</h1>

            <div className="flex flex-wrap items-stretch gap-2 mt-3">
              <CodigoChip label="Código principal" value={codigo} />
              {produto.codigo_principal &&
                produto.codigo_principal !== produto.codigo_produto_interno && (
                  <CodigoChip label="Código interno (legado)" value={produto.codigo_produto_interno} />
                )}
              {produto.numero_produto && (
                <CodigoChip label="Nº / Referência" value={produto.numero_produto} />
              )}
              {codigosExtra.map((codigoExtra) => (
                <CodigoChip key={codigoExtra} label="Código no catálogo" value={codigoExtra} />
              ))}
            </div>

            {medidas.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {medidas.map((medida) => (
                  <span
                    key={medida}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-body-md text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      straighten
                    </span>
                    {medida}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
              {fabricante && (
                <span className="text-body-md text-on-surface-variant">
                  Fabricante: <span className="font-semibold text-on-surface">{fabricante}</span>
                </span>
              )}
              <span className="text-body-md text-on-surface-variant">
                Unidade:{" "}
                <span className="font-semibold text-on-surface">{produto.unidade ?? "PC"}</span>
              </span>
              {espelho && (
                <>
                  <span className="text-body-md text-on-surface-variant">
                    Estoque:{" "}
                    <span className="font-semibold text-on-surface">{espelho.disponivel}</span>
                    {espelho.reservado > 0 ? (
                      <span className="text-on-surface-variant">
                        {" "}
                        ({espelho.reservado} reserv.)
                      </span>
                    ) : null}
                  </span>
                  <span className="text-body-md text-on-surface-variant">
                    Preço:{" "}
                    <span className="font-semibold text-primary">
                      {espelho.preco.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-outline-variant bg-surface text-label-sm text-on-surface-variant uppercase">
                <span className="w-2 h-2 rounded-full bg-secondary-fixed" />
                Catálogo: {nomeCatalogo}
              </span>
            </div>
          </div>

          {/* Referências cruzadas */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <h2 className="text-headline-sm text-on-surface font-semibold px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
              Referências Cruzadas
              {produto.referencias_cruzadas.length > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-primary-container text-on-primary-container text-label-sm">
                  {produto.referencias_cruzadas.length}
                </span>
              )}
            </h2>
            {produto.referencias_cruzadas.length > 0 ? (
              <div className="p-4 flex flex-wrap gap-2">
                {produto.referencias_cruzadas
                  .filter((ref) => ref.numero_referencia)
                  .map((ref) => (
                    <CodigoChip
                      key={ref.id}
                      label={ref.fabricante_referencia ?? "Referência"}
                      value={ref.numero_referencia as string}
                    />
                  ))}
              </div>
            ) : (
              <p className="px-4 py-4 text-body-md text-on-surface-variant">
                Nenhuma referência cruzada cadastrada para este item.
              </p>
            )}
          </section>

          {/* Agregados da montagem */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <h2 className="text-headline-sm text-on-surface font-semibold px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">construction</span>
              Itens da montagem
              {agregados.length > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-primary-container text-on-primary-container text-label-sm">
                  {agregados.length}
                </span>
              )}
            </h2>
            {agregados.length > 0 ? (
              <div className="p-4 space-y-3">
                <ul className="space-y-2">
                  {agregados.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2"
                    >
                      <div className="min-w-0">
                        {a.produtoRelacionadoId ? (
                          <Link
                            href={`/produtos/${a.produtoRelacionadoId}`}
                            className="font-medium text-on-surface hover:text-primary hover:underline line-clamp-1"
                          >
                            {a.titulo}
                          </Link>
                        ) : (
                          <Link
                            href={`/busca?q=${encodeURIComponent(a.codigo)}`}
                            className="font-medium text-on-surface hover:text-primary hover:underline line-clamp-1"
                          >
                            {a.titulo}
                          </Link>
                        )}
                        <p className="font-mono text-code-md text-primary">{a.codigo}</p>
                        <div className="flex gap-2 mt-0.5">
                          {a.obrigatorio && (
                            <span className="text-label-sm text-primary">Obrigatório</span>
                          )}
                          {a.quantidadeSugerida > 1 && (
                            <span className="text-label-sm text-on-surface-variant">
                              Qtd. {a.quantidadeSugerida}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <AdicionarAgregadosButton
                  principal={{
                    produtoId: produto.id,
                    codigo,
                    descricao: produto.descricao ?? titulo,
                    fabricante,
                    fotoUrl: produto.foto_url,
                  }}
                  agregados={agregados}
                />
              </div>
            ) : (
              <div className="px-4 py-4 text-body-md text-on-surface-variant space-y-2">
                <p>Nenhum agregado cadastrado para esta peça.</p>
                <Link href={`/agregados?principal=${produto.id}`} className="text-primary hover:underline">
                  Cadastrar agregados
                </Link>
              </div>
            )}
          </section>

          {/* Aplicações */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <h2 className="text-headline-sm text-primary px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">directions_car</span>
              Aplicações
              {!produto.aplicacao_resumo && (
                <span className="ml-auto text-label-sm text-on-surface-variant uppercase bg-surface-container-high rounded-full px-2 py-0.5">
                  Em breve
                </span>
              )}
            </h2>
            {produto.aplicacao_resumo ? (
              <p className="px-4 py-4 text-body-md text-on-surface">{produto.aplicacao_resumo}</p>
            ) : (
              <p className="px-4 py-4 text-body-md text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                Dados de aplicação por veículo (montadora, modelo, ano, eixo) serão
                exibidos aqui.
              </p>
            )}
          </section>

          {/* Observações */}
          {produto.observacoes && (
            <section>
              <h2 className="text-label-sm text-on-surface-variant mb-1">
                Observações
              </h2>
              <p className="text-body-md text-on-surface-variant">{produto.observacoes}</p>
            </section>
          )}

          {/* Texto original do catálogo — colapsável, só quando a limpeza alterou */}
          {(desc.alterado || textoOriginal !== titulo) && textoOriginal && (
            <details className="group rounded-xl border border-outline-variant bg-surface-container-low shadow-sm">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-body-md text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
                <span className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-90">
                  chevron_right
                </span>
                Texto original do catálogo
              </summary>
              <p className="border-t border-outline-variant px-4 py-3 font-mono text-code-md leading-relaxed text-on-surface-variant">
                {textoOriginal}
              </p>
            </details>
          )}
        </div>
      </div>

      <ProdutoAcoes
        produto={{
          produtoId: produto.id,
          descricao: produto.descricao ?? titulo,
          codigo,
          numeroProduto: produto.numero_produto,
          fabricante,
          catalogo: nomeCatalogo,
          fotoUrl: produto.foto_url,
        }}
        telefoneLoja={contexto?.loja?.telefone_whatsapp}
        precoUnitario={espelho?.preco ?? 0}
      />
    </div>
  );
}
