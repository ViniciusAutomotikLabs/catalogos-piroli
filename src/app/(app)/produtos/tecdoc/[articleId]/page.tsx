import Link from "next/link";
import { notFound } from "next/navigation";
import { getContextoLoja } from "@/lib/loja";
import { buscarTecDocDetalhe } from "@/lib/tecdoc-catalog";
import { ProdutoAcoes } from "@/components/produto/acoes";

export default async function TecDocProdutoPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId: raw } = await params;
  const articleId = parseInt(raw, 10);
  if (Number.isNaN(articleId) || articleId <= 0) notFound();

  const [detalhe, contexto] = await Promise.all([
    buscarTecDocDetalhe(articleId),
    getContextoLoja(),
  ]);

  if (!detalhe) notFound();

  const titulo = detalhe.description ?? detalhe.codigo;
  const aplicacoes = detalhe.aplicacoes.slice(0, 40);

  return (
    <div className="pb-24">
      <nav className="flex items-center gap-2 text-body-md text-on-surface-variant mb-6">
        <Link href="/inicio" className="hover:text-primary hover:underline">
          Início
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/busca" className="hover:text-primary hover:underline">
          Busca
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold line-clamp-1">{titulo}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white border border-outline-variant rounded-xl p-4 flex items-center justify-center aspect-[4/3] sticky top-24 shadow-sm">
            {detalhe.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detalhe.imageUrl}
                alt={titulo}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-outline">
                <span className="material-symbols-outlined text-6xl">image_not_supported</span>
                <span className="text-body-md">Sem imagem neste catálogo</span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-primary/40 bg-primary-container/40 text-label-sm text-on-primary-container uppercase font-semibold">
                <span className="w-2 h-2 rounded-full bg-primary" />
                TecDoc
              </span>
            </div>
            <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">
              {titulo}
            </h1>
            <p className="font-mono text-code-md text-primary mt-2">{detalhe.codigo}</p>
            <p className="text-body-md text-on-surface-variant mt-2">
              Catálogo externo TecDoc — descrição em inglês. Use o código TecDoc no orçamento
              e confirme a aplicação no veículo do cliente.
            </p>
          </div>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <h2 className="text-headline-sm text-on-surface font-semibold px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">directions_car</span>
              Aplicações
              {aplicacoes.length > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-primary-container text-on-primary-container text-label-sm">
                  {aplicacoes.length}
                </span>
              )}
            </h2>
            {aplicacoes.length > 0 ? (
              <ul className="divide-y divide-outline-variant max-h-80 overflow-y-auto">
                {aplicacoes.map((app) => (
                  <li key={app} className="px-4 py-2.5 text-body-md text-on-surface">
                    {app}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-body-md text-on-surface-variant">
                Nenhuma aplicação listada para este artigo.
              </p>
            )}
          </section>
        </div>
      </div>

      <ProdutoAcoes
        produto={{
          produtoId: null,
          codigo: detalhe.codigo,
          descricao: detalhe.description ?? detalhe.codigo,
          fabricante: "TecDoc",
          catalogo: "TecDoc",
          fotoUrl: detalhe.imageUrl,
        }}
        telefoneLoja={contexto?.loja?.telefone_whatsapp}
      />
    </div>
  );
}
