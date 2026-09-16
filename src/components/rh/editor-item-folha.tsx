"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { salvarItemFolha, type EstadoRH } from "@/lib/actions/rh-folha";

const INPUT =
  "px-2 py-1.5 bg-surface-container-lowest border border-outline-variant rounded text-body-md text-on-surface focus:border-primary outline-none transition-colors";

export type Rubrica = { descricao: string; valor: number };
export type ItemFolha = {
  id: number;
  competenciaId: number;
  nome: string;
  salarioBase: number;
  proventos: Rubrica[];
  descontos: Rubrica[];
  inss: number;
  irrf: number;
  fgts: number;
  totalProventos: number;
  totalDescontos: number;
  liquido: number;
};

const brl = (v: number) => `R$ ${(v ?? 0).toFixed(2)}`;

export function EditorItemFolha({ item, fechada }: { item: ItemFolha; fechada: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [estado, action, pend] = useActionState<EstadoRH, FormData>(salvarItemFolha, null);
  const [proventos, setProventos] = useState<Rubrica[]>(item.proventos ?? []);
  const [descontos, setDescontos] = useState<Rubrica[]>(item.descontos ?? []);

  return (
    <>
      <tr className="border-b border-outline-variant hover:bg-primary-fixed/20">
        <td className="px-4 py-2 font-medium text-on-surface">{item.nome}</td>
        <td className="px-4 py-2 text-right font-mono">{brl(item.salarioBase)}</td>
        <td className="px-4 py-2 text-right font-mono text-on-surface-variant">{brl(item.inss)}</td>
        <td className="px-4 py-2 text-right font-mono text-on-surface-variant">{brl(item.irrf)}</td>
        <td className="px-4 py-2 text-right font-mono text-on-surface-variant">{brl(item.fgts)}</td>
        <td className="px-4 py-2 text-right font-mono font-bold text-primary">{brl(item.liquido)}</td>
        <td className="px-4 py-2 text-right">
          <div className="flex items-center gap-1 justify-end">
            <Link
              href={`/rh/holerite/${item.id}`}
              target="_blank"
              className="inline-flex w-8 h-8 rounded-lg bg-surface-container hover:bg-primary hover:text-on-primary text-primary items-center justify-center"
              title="Holerite"
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            </Link>
            {!fechada && (
              <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                className="inline-flex w-8 h-8 rounded-lg bg-surface-container hover:bg-primary hover:text-on-primary text-primary items-center justify-center"
                title="Lançar proventos/descontos"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {aberto ? "expand_less" : "edit"}
                </span>
              </button>
            )}
          </div>
        </td>
      </tr>
      {aberto && !fechada && (
        <tr className="bg-surface-container-low">
          <td colSpan={7} className="px-4 py-4">
            <form action={action} className="space-y-4">
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="competencia_id" value={item.competenciaId} />
              <input type="hidden" name="proventos" value={JSON.stringify(proventos)} readOnly />
              <input type="hidden" name="descontos" value={JSON.stringify(descontos)} readOnly />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ListaRubricas
                  titulo="Proventos (h. extra, comissão…)"
                  cor="text-primary"
                  rubricas={proventos}
                  setRubricas={setProventos}
                />
                <ListaRubricas
                  titulo="Descontos (vale, adiantamento…)"
                  cor="text-error"
                  rubricas={descontos}
                  setRubricas={setDescontos}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pend}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">calculate</span>
                  {pend ? "Recalculando…" : "Salvar e recalcular"}
                </button>
                {estado?.erro && <span className="text-label-sm text-error">{estado.erro}</span>}
                {estado?.ok && <span className="text-label-sm text-primary">{estado.mensagem}</span>}
                <span className="text-label-sm text-on-surface-variant ml-auto">
                  INSS/IRRF são recalculados sobre o salário base.
                </span>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function ListaRubricas({
  titulo,
  cor,
  rubricas,
  setRubricas,
}: {
  titulo: string;
  cor: string;
  rubricas: Rubrica[];
  setRubricas: React.Dispatch<React.SetStateAction<Rubrica[]>>;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className={`text-label-sm font-semibold uppercase ${cor}`}>{titulo}</h4>
        <button
          type="button"
          onClick={() => setRubricas((p) => [...p, { descricao: "", valor: 0 }])}
          className="text-primary hover:bg-primary-fixed/40 rounded p-1"
          aria-label="Adicionar rubrica"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
      </div>
      <div className="space-y-2">
        {rubricas.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={r.descricao}
              onChange={(e) =>
                setRubricas((p) => p.map((x, idx) => (idx === i ? { ...x, descricao: e.target.value } : x)))
              }
              placeholder="Descrição"
              className={`${INPUT} flex-1`}
            />
            <input
              type="number"
              step="0.01"
              value={r.valor}
              onChange={(e) =>
                setRubricas((p) =>
                  p.map((x, idx) => (idx === i ? { ...x, valor: Number(e.target.value) } : x))
                )
              }
              className={`${INPUT} w-28 font-mono text-right`}
            />
            <button
              type="button"
              onClick={() => setRubricas((p) => p.filter((_, idx) => idx !== i))}
              className="text-error hover:bg-error-container/40 rounded p-1"
              aria-label="Remover rubrica"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ))}
        {rubricas.length === 0 && (
          <p className="text-label-sm text-on-surface-variant">Nenhum lançamento.</p>
        )}
      </div>
    </div>
  );
}
