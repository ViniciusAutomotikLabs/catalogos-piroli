import Link from "next/link";
import { requireModulo, getContextoLoja } from "@/lib/loja";
import { createErpClient } from "@/lib/supabase/erp";
import { boundsDiaSp, hojeSp, nomeCliente } from "@/lib/vendas-dia";

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

function buildUrl(opts: { dia: string; status?: string }) {
  const sp = new URLSearchParams();
  sp.set("dia", opts.dia);
  if (opts.status && opts.status !== "todos") sp.set("status", opts.status);
  return `/vendas?${sp.toString()}`;
}

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; status?: string }>;
}) {
  await requireModulo("vendas");
  const contexto = await getContextoLoja();
  const params = await searchParams;
  const dia = (params.dia?.trim() || hojeSp()).slice(0, 10);
  const statusFiltro = (params.status ?? "todos").trim().toLowerCase();
  const { inicio, fim } = boundsDiaSp(dia);

  const sb = await createErpClient();

  let q = sb
    .from("vendas")
    .select(
      "id, status, entrega_status, total, criado_em, cliente_id, pessoa_id, clientes(razao_social, nome_fantasia), pessoas(nome, nome_fantasia)"
    )
    .eq("organizacao_id", contexto!.organizacaoId!)
    .eq("loja_id", contexto!.lojaId!)
    .gte("criado_em", inicio)
    .lt("criado_em", fim)
    .order("criado_em", { ascending: false })
    .limit(200);

  if (
    statusFiltro !== "todos" &&
    ["rascunho", "aberta", "fechada", "cancelada"].includes(statusFiltro)
  ) {
    q = q.eq("status", statusFiltro);
  }

  const { data: vendas } = await q;

  const lista = vendas ?? [];
  const ativas = lista.filter((v) => v.status !== "cancelada");
  const qtdDia = ativas.length;
  const totalDia = ativas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);

  const statusTabs = [
    { key: "todos", label: "Todos" },
    { key: "aberta", label: "Abertas" },
    { key: "fechada", label: "Fechadas" },
    { key: "cancelada", label: "Canceladas" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">
            Vendas
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Orçamento → venda → entrega · só vendas deste ERP (não da SS)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/entregas"
            className="px-4 py-2 rounded-lg border border-outline-variant text-label-sm uppercase hover:border-primary hover:text-primary"
          >
            Fila de entregas
          </Link>
          <Link
            href="/orcamento"
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase"
          >
            Novo pelo orçamento
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <label className="text-label-sm text-on-surface-variant">
          Dia
          <input
            type="date"
            name="dia"
            defaultValue={dia}
            className="ml-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md outline-none focus:border-primary"
          />
        </label>
        {statusFiltro !== "todos" && (
          <input type="hidden" name="status" value={statusFiltro} />
        )}
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase"
        >
          Filtrar
        </button>
        {dia !== hojeSp() && (
          <Link
            href={buildUrl({ dia: hojeSp(), status: statusFiltro })}
            className="px-4 py-2 rounded-lg border border-outline-variant text-label-sm uppercase hover:border-primary hover:text-primary"
          >
            Hoje
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-label-sm text-on-surface-variant uppercase">
            Vendas no dia
          </p>
          <p className="text-headline-lg font-bold text-on-surface mt-1 tabular-nums">
            {qtdDia}
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-label-sm text-on-surface-variant uppercase">
            Total no dia
          </p>
          <p className="text-headline-lg font-bold text-primary mt-1">
            {formatBRL(totalDia)}
          </p>
          <p className="text-label-sm text-on-surface-variant mt-1">
            Exclui canceladas
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((t) => {
          const ativo =
            statusFiltro === t.key ||
            (t.key === "todos" && statusFiltro === "todos");
          return (
            <Link
              key={t.key}
              href={buildUrl({ dia, status: t.key })}
              className={`px-3 py-1.5 rounded-lg text-label-sm uppercase border transition-colors ${
                ativo
                  ? "bg-primary-container border-primary text-on-primary-container"
                  : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead className="bg-surface-container-high text-on-surface-variant text-label-sm">
              <tr>
                <th className="py-3 px-4 font-semibold">#</th>
                <th className="py-3 px-4 font-semibold">Hora</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Entrega</th>
                <th className="py-3 px-4 font-semibold text-right">Total</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-on-surface-variant"
                  >
                    <p className="text-body-lg">Nenhuma venda neste dia.</p>
                    <p className="text-body-md mt-2 max-w-md mx-auto">
                      Vendas do balcão na SS Plus não aparecem aqui. Crie pelo
                      orçamento neste ERP.
                    </p>
                    <Link
                      href="/orcamento"
                      className="inline-flex mt-4 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase"
                    >
                      Ir ao orçamento
                    </Link>
                  </td>
                </tr>
              )}
              {lista.map((v) => {
                const hora = new Date(v.criado_em).toLocaleTimeString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <tr
                    key={v.id}
                    className="border-t border-outline-variant hover:bg-primary-fixed/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-code-md">{v.id}</td>
                    <td className="py-3 px-4 text-on-surface-variant tabular-nums">
                      {hora}
                    </td>
                    <td className="py-3 px-4">{nomeCliente(v)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-label-sm uppercase border ${
                          v.status === "fechada"
                            ? "border-primary/40 bg-primary-container/40 text-on-primary-container"
                            : v.status === "cancelada"
                              ? "border-error/40 bg-error-container/30 text-error"
                              : "border-outline-variant text-on-surface"
                        }`}
                      >
                        {STATUS_LABEL[v.status] ?? v.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize text-on-surface-variant">
                      {ENTREGA_LABEL[v.entrega_status] ?? v.entrega_status}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums">
                      {formatBRL(Number(v.total) || 0)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/vendas/${v.id}`}
                        className="text-primary text-label-sm uppercase hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
