import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModulo, getContextoLoja } from "@/lib/loja";
import { createErpClient } from "@/lib/supabase/erp";
import { AcoesVenda } from "@/components/vendas/acoes-venda";
import { unwrapOne } from "@/lib/vendas-dia";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aberta: "Aberta",
  fechada: "Fechada",
  cancelada: "Cancelada",
};

const ENTREGA_LABEL: Record<string, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  entregue: "Entregue",
  retirada: "Retirada",
};

function badgeStatus(status: string) {
  if (status === "fechada") {
    return "border-primary/40 bg-primary-container/40 text-on-primary-container";
  }
  if (status === "cancelada") {
    return "border-error/40 bg-error-container/30 text-error";
  }
  return "border-outline-variant text-on-surface";
}

export default async function VendaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModulo("vendas");
  const { id } = await params;
  const vendaId = Number(id);
  if (!Number.isFinite(vendaId)) notFound();

  const contexto = await getContextoLoja();
  const sb = await createErpClient();

  const { data: venda } = await sb
    .from("vendas")
    .select(
      `id, status, entrega_status, total, observacao, criado_em,
       comissao_oficina_pct, comissao_mecanico_pct,
       oficina_pessoa_id, mecanico_pessoa_id, orcamento_id, cliente_id, pessoa_id,
       clientes(id, razao_social, nome_fantasia),
       pessoas(id, nome, nome_fantasia)`
    )
    .eq("id", vendaId)
    .eq("organizacao_id", contexto!.organizacaoId!)
    .eq("loja_id", contexto!.lojaId!)
    .maybeSingle();

  if (!venda) notFound();

  const { data: itens } = await sb
    .from("venda_itens")
    .select(
      "id, codigo, descricao, quantidade, quantidade_entregue, preco_unitario"
    )
    .eq("venda_id", vendaId)
    .order("id");

  const { data: titulo } = await sb
    .from("financeiro_titulos")
    .select("id, status, valor")
    .eq("venda_id", vendaId)
    .eq("organizacao_id", contexto!.organizacaoId!)
    .eq("tipo", "receber")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const clienteEmbed = unwrapOne(
    venda.clientes as
      | { id: number; razao_social: string | null; nome_fantasia: string | null }
      | { id: number; razao_social: string | null; nome_fantasia: string | null }[]
      | null
  );
  const pessoaEmbed = unwrapOne(
    venda.pessoas as
      | { id: number; nome: string | null; nome_fantasia: string | null }
      | { id: number; nome: string | null; nome_fantasia: string | null }[]
      | null
  );

  const nomeCliente =
    (clienteEmbed?.nome_fantasia || clienteEmbed?.razao_social || "").trim() ||
    (pessoaEmbed?.nome_fantasia || pessoaEmbed?.nome || "").trim() ||
    null;

  const criadoFmt = new Date(venda.criado_em).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/vendas"
            className="text-label-sm text-primary uppercase hover:underline"
          >
            ← Vendas
          </Link>
          <h1 className="text-headline-lg text-on-surface font-bold tracking-tight mt-1">
            Venda #{venda.id}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">{criadoFmt}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span
              className={`inline-flex rounded px-2 py-0.5 text-label-sm uppercase border ${badgeStatus(venda.status)}`}
            >
              {STATUS_LABEL[venda.status] ?? venda.status}
            </span>
            <span className="inline-flex rounded px-2 py-0.5 text-label-sm uppercase border border-outline-variant text-on-surface-variant">
              Entrega · {ENTREGA_LABEL[venda.entrega_status] ?? venda.entrega_status}
            </span>
          </div>
        </div>
        <p className="text-headline-sm font-bold text-primary">
          {formatBRL(Number(venda.total) || 0)}
        </p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <div>
          <dt className="text-label-sm text-on-surface-variant">Cliente</dt>
          <dd className="text-body-lg font-medium text-on-surface mt-0.5">
            {nomeCliente ? (
              pessoaEmbed?.id ? (
                <Link
                  href={`/pessoas/${pessoaEmbed.id}`}
                  className="hover:text-primary hover:underline"
                >
                  {nomeCliente}
                </Link>
              ) : (
                nomeCliente
              )
            ) : (
              <span className="text-on-surface-variant">Sem cliente</span>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          {venda.orcamento_id ? (
            <div>
              <dt className="text-label-sm text-on-surface-variant">Orçamento</dt>
              <dd className="mt-0.5">
                <span className="font-mono text-code-md">#{venda.orcamento_id}</span>
                <span className="text-on-surface-variant text-body-md">
                  {" "}
                  (origem salva)
                </span>
              </dd>
            </div>
          ) : (
            <div>
              <dt className="text-label-sm text-on-surface-variant">Origem</dt>
              <dd className="text-body-md text-on-surface-variant mt-0.5">
                Carrinho de orçamento
              </dd>
            </div>
          )}
          {titulo ? (
            <Link
              href="/caixa"
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2 text-label-sm uppercase hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">payments</span>
              Ver no caixa
              <span className="text-on-surface-variant normal-case">
                ({titulo.status})
              </span>
            </Link>
          ) : venda.status === "aberta" ? (
            <p className="text-label-sm text-on-surface-variant">
              Título no caixa após fechar a venda
            </p>
          ) : null}
        </div>
      </dl>

      {(Number(venda.comissao_oficina_pct) > 0 ||
        Number(venda.comissao_mecanico_pct) > 0) && (
        <p className="text-body-md text-on-surface-variant">
          Comissão oficina {venda.comissao_oficina_pct}% · mecânico{" "}
          {venda.comissao_mecanico_pct}%
        </p>
      )}

      {venda.observacao && (
        <p className="text-body-md text-on-surface bg-surface-container-low rounded-lg px-3 py-2">
          {venda.observacao}
        </p>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-high text-label-sm text-on-surface-variant">
            <tr>
              <th className="py-3 px-4">Código</th>
              <th className="py-3 px-4">Descrição</th>
              <th className="py-3 px-4 text-right">Qtd</th>
              <th className="py-3 px-4 text-right">Entregue</th>
              <th className="py-3 px-4 text-right">Preço</th>
              <th className="py-3 px-4 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(itens ?? []).map((i) => (
              <tr key={i.id} className="border-t border-outline-variant">
                <td className="py-3 px-4 font-mono text-code-md">
                  {i.codigo ?? "—"}
                </td>
                <td className="py-3 px-4">{i.descricao}</td>
                <td className="py-3 px-4 text-right tabular-nums">{i.quantidade}</td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {i.quantidade_entregue}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatBRL(Number(i.preco_unitario) || 0)}
                </td>
                <td className="py-3 px-4 text-right font-semibold tabular-nums">
                  {formatBRL(
                    (Number(i.quantidade) || 0) * (Number(i.preco_unitario) || 0)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AcoesVenda
        vendaId={venda.id}
        status={venda.status}
        entregaStatus={venda.entrega_status}
      />
    </div>
  );
}
