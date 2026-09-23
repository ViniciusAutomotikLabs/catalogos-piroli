import Link from "next/link";
import { requireModulo } from "@/lib/loja";
import { listarEspelho } from "@/lib/espelho";
import { obterSyncLegadoAtivo } from "@/lib/actions/sync-legado";
import { AjusteSaldoForm } from "@/components/estoque/ajuste-saldo-form";

const POR_PAGINA = 50;

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildUrl(opts: { q?: string; pagina?: number }) {
  const sp = new URLSearchParams();
  if (opts.q) sp.set("q", opts.q);
  if (opts.pagina && opts.pagina > 1) sp.set("pagina", String(opts.pagina));
  const s = sp.toString();
  return s ? `/estoque?${s}` : "/estoque";
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  await requireModulo("estoque");
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const pagina = Math.max(parseInt(params.pagina ?? "1", 10) || 1, 1);

  const [{ itens, total, porPagina }, syncAtivo] = await Promise.all([
    listarEspelho({ termo: q || undefined, limite: POR_PAGINA, pagina }),
    obterSyncLegadoAtivo(),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const de = total === 0 ? 0 : (paginaAtual - 1) * porPagina + 1;
  const ate = Math.min(paginaAtual * porPagina, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">
            Estoque
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Espelho operacional · sync SS Plus{" "}
            {syncAtivo ? "ligada" : "desligada"}
            {total > 0 && (
              <>
                {" "}
                · {total.toLocaleString("pt-BR")} SKUs
              </>
            )}
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Interno, fabricante, marca…"
            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary w-64"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase"
          >
            Buscar
          </button>
        </form>
      </div>

      <AjusteSaldoForm />

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead className="bg-surface-container-high text-on-surface-variant text-label-sm">
            <tr>
              <th className="py-3 px-4 font-semibold">Cód. interno</th>
              <th className="py-3 px-4 font-semibold">Cód. fabricante</th>
              <th className="py-3 px-4 font-semibold">Marca</th>
              <th className="py-3 px-4 font-semibold">Descrição</th>
              <th className="py-3 px-4 font-semibold text-right">Disponível</th>
              <th className="py-3 px-4 font-semibold text-right">Reservado</th>
              <th className="py-3 px-4 font-semibold text-right">Preço</th>
              <th className="py-3 px-4 font-semibold w-20" />
            </tr>
          </thead>
          <tbody className="text-body-md">
            {itens.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                  Nenhum saldo no espelho.{" "}
                  {syncAtivo
                    ? "Aguarde o sync ou faça um ajuste manual."
                    : "Sync desligada — use ajuste manual ou vendas."}
                </td>
              </tr>
            )}
            {itens.map((i) => (
              <tr
                key={`${i.codigo}-${i.unidadeId}`}
                className="border-t border-outline-variant hover:bg-primary-fixed/30 transition-colors"
              >
                <td className="py-3 px-4">
                  <Link
                    href={`/estoque/${encodeURIComponent(i.codigo)}`}
                    className="font-mono text-code-md text-primary hover:underline"
                  >
                    {i.codigo}
                  </Link>
                </td>
                <td className="py-3 px-4 font-mono text-code-md text-on-surface">
                  {i.codigoFabricante ?? "—"}
                </td>
                <td className="py-3 px-4 uppercase text-on-surface">
                  {i.marca ?? "—"}
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/estoque/${encodeURIComponent(i.codigo)}`}
                    className="hover:text-primary line-clamp-2"
                  >
                    {i.descricao ?? "—"}
                  </Link>
                </td>
                <td className="py-3 px-4 text-right font-semibold">{i.disponivel}</td>
                <td className="py-3 px-4 text-right text-on-surface-variant">{i.reservado}</td>
                <td className="py-3 px-4 text-right">{formatBRL(i.preco)}</td>
                <td className="py-3 px-4 text-right">
                  <Link
                    href={`/estoque/${encodeURIComponent(i.codigo)}`}
                    className="text-primary text-label-sm uppercase hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant px-4 py-3 text-body-md text-on-surface-variant">
            <span>
              {de}–{ate} de {total.toLocaleString("pt-BR")}
            </span>
            <div className="flex items-center gap-2">
              {paginaAtual > 1 ? (
                <Link
                  href={buildUrl({ q: q || undefined, pagina: paginaAtual - 1 })}
                  className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-sm uppercase hover:border-primary hover:text-primary"
                >
                  Anterior
                </Link>
              ) : (
                <span className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-label-sm uppercase text-outline">
                  Anterior
                </span>
              )}
              <span className="tabular-nums text-label-sm">
                Página {paginaAtual} / {totalPaginas.toLocaleString("pt-BR")}
              </span>
              {paginaAtual < totalPaginas ? (
                <Link
                  href={buildUrl({ q: q || undefined, pagina: paginaAtual + 1 })}
                  className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-sm uppercase hover:border-primary hover:text-primary"
                >
                  Próxima
                </Link>
              ) : (
                <span className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-label-sm uppercase text-outline">
                  Próxima
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
