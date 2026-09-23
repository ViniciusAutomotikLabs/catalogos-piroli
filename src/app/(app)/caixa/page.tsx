import Link from "next/link";
import { listarCaixaDoDia } from "@/lib/actions/financeiro";
import { BotaoMarcarPago } from "@/components/caixa/botao-marcar-pago";
import { hojeSp } from "@/lib/vendas-dia";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const diaRaw = (d ?? hojeSp()).trim().slice(0, 10);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaRaw) ? diaRaw : hojeSp();
  const caixa = await listarCaixaDoDia(dia);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">
            Caixa do dia
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Títulos a receber · fuso America/Sao_Paulo
          </p>
        </div>
        <form className="flex gap-2 items-center">
          <label className="text-label-sm text-on-surface-variant">
            Data
            <input
              type="date"
              name="d"
              defaultValue={dia}
              className="ml-2 rounded-lg border border-outline-variant px-3 py-2 text-body-md"
            />
          </label>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase">
            Filtrar
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-label-sm text-on-surface-variant uppercase">Pago no dia</p>
          <p className="text-headline-lg font-bold text-primary mt-1">
            {formatBRL(caixa.totalPago)}
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-label-sm text-on-surface-variant uppercase">Em aberto</p>
          <p className="text-headline-lg font-bold text-on-surface mt-1">
            {formatBRL(caixa.totalAberto)}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-headline-sm font-semibold">Em aberto</h2>
        <ul className="space-y-2">
          {caixa.abertos.length === 0 && (
            <li className="text-on-surface-variant py-6 text-center border border-dashed border-outline-variant rounded-xl">
              Nenhum título em aberto.
            </li>
          )}
          {caixa.abertos.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-4"
            >
              <div>
                <p className="font-semibold text-on-surface">{t.descricao}</p>
                <p className="text-body-md text-on-surface-variant">
                  {formatBRL(t.valor)}
                  {t.venda_id ? (
                    <>
                      {" · "}
                      <Link href={`/vendas/${t.venda_id}`} className="text-primary hover:underline">
                        Venda #{t.venda_id}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <BotaoMarcarPago tituloId={t.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-headline-sm font-semibold">Pagos neste dia</h2>
        <ul className="space-y-2">
          {caixa.pagos.length === 0 && (
            <li className="text-on-surface-variant py-6 text-center border border-dashed border-outline-variant rounded-xl">
              Nenhum recebimento neste dia.
            </li>
          )}
          {caixa.pagos.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-4"
            >
              <div>
                <p className="font-semibold text-on-surface">{t.descricao}</p>
                <p className="text-body-md text-on-surface-variant">
                  {formatBRL(t.valor)}
                  {t.pago_em
                    ? ` · ${new Date(t.pago_em).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </p>
              </div>
              {t.venda_id ? (
                <Link href={`/vendas/${t.venda_id}`} className="text-primary text-label-sm uppercase hover:underline">
                  Ver venda
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
