import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";
import { FormCliente } from "@/components/clientes/form-cliente";
import { atualizarCliente } from "@/lib/actions/clientes";
import { buildContatoLojaUrl } from "@/lib/whatsapp";

const ESPECIALIDADES: Record<string, string> = {
  multimarcas: "Multimarcas",
  especializada: "Especializada",
  linha_pesada: "Linha Pesada",
};

type ItemOrcamento = {
  quantidade: number;
  preco_unitario: number;
  descricao_avulsa: string | null;
  produtos: {
    id: number;
    codigo_produto_interno: string;
    descricao: string | null;
    foto_url: string | null;
  } | null;
};

type OrcamentoRow = {
  id: number;
  status: string;
  criado_em: string;
  orcamento_itens: ItemOrcamento[];
};

type ProdutoResumo = {
  key: string;
  produtoId: number | null;
  codigo: string;
  descricao: string;
  totalQtd: number;
  vezes: number;
  fotoUrl: string | null;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function agregarProdutos(orcamentos: OrcamentoRow[]): ProdutoResumo[] {
  const map = new Map<string, ProdutoResumo>();

  for (const orc of orcamentos) {
    for (const item of orc.orcamento_itens) {
      const produto = item.produtos;
      const key = produto ? `p-${produto.id}` : `a-${item.descricao_avulsa ?? "?"}`;
      const atual = map.get(key) ?? {
        key,
        produtoId: produto?.id ?? null,
        codigo: produto?.codigo_produto_interno ?? "—",
        descricao: produto?.descricao ?? item.descricao_avulsa ?? "Peça avulsa",
        totalQtd: 0,
        vezes: 0,
        fotoUrl: produto?.foto_url ?? null,
      };
      atual.totalQtd += item.quantidade;
      atual.vezes += 1;
      map.set(key, atual);
    }
  }

  return [...map.values()].sort((a, b) => b.totalQtd - a.totalQtd || b.vezes - a.vezes);
}

export default async function ClientePerfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clienteId = Number(id);
  if (!clienteId) notFound();

  const contexto = await getContextoLoja();
  if (!contexto?.lojaId) notFound();

  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", clienteId)
    .eq("loja_id", contexto.lojaId)
    .maybeSingle();

  if (!cliente) notFound();

  const { data: orcamentosRaw } = await supabase
    .from("orcamentos")
    .select(
      `
      id, status, criado_em,
      orcamento_itens (
        quantidade, preco_unitario, descricao_avulsa,
        produtos ( id, codigo_produto_interno, descricao, foto_url )
      )
    `
    )
    .eq("cliente_id", clienteId)
    .eq("loja_id", contexto.lojaId)
    .order("criado_em", { ascending: false })
    .limit(50);

  const orcamentos = (orcamentosRaw ?? []) as OrcamentoRow[];
  const produtosFrequentes = agregarProdutos(orcamentos);
  const totalOrcamentos = orcamentos.length;
  const totalItens = orcamentos.reduce((acc, o) => acc + o.orcamento_itens.length, 0);
  const nomeExibicao = cliente.nome_fantasia ?? cliente.razao_social;

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-2 text-body-md text-on-surface-variant">
        <Link href="/clientes" className="hover:text-primary hover:underline">
          CRM
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold">{nomeExibicao}</span>
      </nav>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">{nomeExibicao}</h1>
                <p className="text-body-md text-on-surface-variant mt-1">{cliente.razao_social}</p>
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 bg-primary-fixed/30 text-label-sm text-primary uppercase">
                    {ESPECIALIDADES[cliente.especialidade ?? "multimarcas"]}
                  </span>
                  {!cliente.ativo && (
                    <span className="text-label-sm text-error uppercase border border-error/40 rounded px-1.5">
                      Inativo
                    </span>
                  )}
                </div>
              </div>
              {cliente.telefone_whatsapp && (
                <a
                  href={buildContatoLojaUrl(cliente.telefone_whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-on-secondary text-label-sm uppercase hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  WhatsApp
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-headline-md font-bold text-on-surface font-mono">{totalOrcamentos}</p>
                <p className="text-label-sm text-on-surface-variant">Orçamentos</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-headline-md font-bold text-on-surface font-mono">{totalItens}</p>
                <p className="text-label-sm text-on-surface-variant">Itens pedidos</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-headline-md font-bold text-on-surface">
                  {cliente.ultima_compra_em
                    ? new Date(cliente.ultima_compra_em).toLocaleDateString("pt-BR")
                    : "—"}
                </p>
                <p className="text-label-sm text-on-surface-variant">Última compra</p>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h2 className="text-headline-sm text-primary">O que costuma comprar</h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Peças mais frequentes nos orçamentos salvos para este cliente
              </p>
            </div>
            {produtosFrequentes.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-outline text-4xl">inventory_2</span>
                <p className="text-body-md">Nenhum orçamento vinculado ainda.</p>
                <p className="text-label-sm">Salve um orçamento selecionando este cliente no carrinho.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-surface-container-high border-b border-outline-variant text-label-sm text-on-surface-variant tracking-wide">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Peça</th>
                    <th className="px-4 py-3 w-28 font-semibold">Qtd total</th>
                    <th className="px-4 py-3 w-28 font-semibold">Vezes</th>
                    <th className="px-4 py-3 w-24 text-right font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosFrequentes.map((p) => (
                    <tr key={p.key} className="border-b border-outline-variant hover:bg-surface-container-low">
                      <td className="px-4 py-3">
                        <p className="font-bold text-on-surface">{p.descricao}</p>
                        <p className="text-label-sm text-on-surface-variant font-mono">{p.codigo}</p>
                      </td>
                      <td className="px-4 py-3 font-mono">{p.totalQtd}</td>
                      <td className="px-4 py-3">{p.vezes}</td>
                      <td className="px-4 py-3 text-right">
                        {p.produtoId ? (
                          <Link
                            href={`/produtos/${p.produtoId}`}
                            className="text-label-sm text-primary uppercase hover:underline"
                          >
                            Ver peça
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h2 className="text-headline-sm text-primary">Histórico de orçamentos</h2>
            </div>
            {orcamentos.length === 0 ? (
              <p className="px-6 py-8 text-body-md text-on-surface-variant">Sem histórico ainda.</p>
            ) : (
              <div className="divide-y divide-outline-variant">
                {orcamentos.map((orc) => {
                  const total = orc.orcamento_itens.reduce(
                    (acc, i) => acc + i.quantidade * Number(i.preco_unitario),
                    0
                  );
                  return (
                    <div key={orc.id} className="px-6 py-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                        <div>
                          <p className="font-bold text-on-surface">
                            Orçamento #{orc.id}
                            <span className="ml-2 text-label-sm text-on-surface-variant uppercase">
                              {orc.status}
                            </span>
                          </p>
                          <p className="text-label-sm text-on-surface-variant">
                            {new Date(orc.criado_em).toLocaleString("pt-BR")} · {orc.orcamento_itens.length} item(ns)
                            {total > 0 ? ` · ${formatBRL(total)}` : ""}
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-1 text-body-md text-on-surface-variant">
                        {orc.orcamento_itens.map((item, idx) => {
                          const desc = item.produtos?.descricao ?? item.descricao_avulsa ?? "Peça";
                          const codigo = item.produtos?.codigo_produto_interno ?? "—";
                          return (
                            <li key={idx}>
                              {item.quantidade}x {desc}{" "}
                              <span className="font-mono text-code-md text-primary">({codigo})</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <FormCliente
            action={atualizarCliente}
            cliente={{
              id: cliente.id,
              razao_social: cliente.razao_social,
              nome_fantasia: cliente.nome_fantasia,
              cnpj: cliente.cnpj,
              contato_nome: cliente.contato_nome,
              telefone_whatsapp: cliente.telefone_whatsapp,
              email: cliente.email,
              especialidade: cliente.especialidade,
              marcas: cliente.marcas,
              cep: cliente.cep,
              logradouro: cliente.logradouro,
              numero: cliente.numero,
              complemento: cliente.complemento,
              bairro: cliente.bairro,
              cidade: cliente.cidade,
              uf: cliente.uf,
              ativo: cliente.ativo,
            }}
            cancelHref="/clientes"
            submitLabel="Salvar alterações"
            titulo="Editar cadastro"
            subtitulo="Atualize os dados da oficina"
          />
        </aside>
      </div>
    </div>
  );
}
