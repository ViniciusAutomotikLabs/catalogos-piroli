"use client";

import { useActionState, useTransition } from "react";
import {
  salvarRescisao,
  alternarChecklistRescisao,
  type EstadoRH,
} from "@/lib/actions/rh-rescisao";
import { LabelComAjuda } from "@/components/ui/label-com-ajuda";

const INPUT =
  "px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors";

const TIPOS = [
  { valor: "sem_justa_causa", label: "Sem justa causa" },
  { valor: "pedido_demissao", label: "Pedido de demissão" },
  { valor: "justa_causa", label: "Justa causa" },
  { valor: "acordo", label: "Acordo (484-A)" },
  { valor: "fim_contrato", label: "Fim de contrato" },
];

export type Verba = { descricao: string; valor: number; tipo: "provento" | "desconto" };
export type ItemChecklist = { item: string; ok: boolean };
export type RescisaoExistente = {
  id: number;
  tipo: string;
  motivo: string | null;
  data_desligamento: string;
  verbas: Verba[];
  checklist: ItemChecklist[];
};

const brl = (v: number) => `R$ ${v.toFixed(2)}`;

export function FormRescisao({
  contratoId,
  pessoaId,
  existente,
}: {
  contratoId: number;
  pessoaId: number;
  existente?: RescisaoExistente | null;
}) {
  const [estado, action, pend] = useActionState<EstadoRH, FormData>(salvarRescisao, null);
  const [isPending, startTransition] = useTransition();

  if (existente) {
    const total = existente.verbas.reduce(
      (s, v) => s + (v.tipo === "provento" ? v.valor : -v.valor),
      0
    );
    return (
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-headline-sm text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Rescisão registrada
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {TIPOS.find((t) => t.valor === existente.tipo)?.label ?? existente.tipo} ·{" "}
          desligamento em {existente.data_desligamento}
        </p>

        <div>
          <h3 className="text-label-sm text-on-surface-variant mb-2">Verbas (estimativa)</h3>
          <ul className="divide-y divide-outline-variant">
            {existente.verbas.map((v, i) => (
              <li key={i} className="flex justify-between py-1.5 text-body-md">
                <span className="text-on-surface">{v.descricao}</span>
                <span className={v.tipo === "desconto" ? "text-error" : "text-on-surface"}>
                  {v.tipo === "desconto" ? "- " : ""}
                  {brl(v.valor)}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between pt-2 text-body-lg font-bold text-primary">
            <span>Total líquido estimado</span>
            <span>{brl(total)}</span>
          </p>
        </div>

        <div>
          <h3 className="text-label-sm text-on-surface-variant mb-2">Checklist de desligamento</h3>
          <ul className="space-y-1">
            {existente.checklist.map((c, i) => (
              <li key={i}>
                <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.ok}
                    disabled={isPending}
                    onChange={() =>
                      startTransition(() =>
                        void alternarChecklistRescisao(existente.id, i, pessoaId)
                      )
                    }
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className={c.ok ? "line-through text-on-surface-variant" : ""}>{c.item}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-label-sm text-outline">
          Estimativa para conferência com o contador — não substitui o TRCT oficial.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-surface-container-lowest border border-error/30 rounded-xl p-6 shadow-sm">
      <h2 className="text-headline-sm text-error mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px]">logout</span>
        Registrar rescisão
      </h2>
      <form action={action} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <input type="hidden" name="contrato_id" value={contratoId} />
        <input type="hidden" name="pessoa_id" value={pessoaId} />

        <Campo label="Tipo" ajuda="Motivo da rescisão (sem justa causa, pedido, acordo 484-A, etc.).">
          <select name="tipo" defaultValue="sem_justa_causa" className={INPUT}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Aviso prévio" ajuda="Aviso trabalhado, indenizado ou dispensado.">
          <select name="aviso_tipo" defaultValue="indenizado" className={INPUT}>
            <option value="indenizado">Indenizado</option>
            <option value="trabalhado">Trabalhado</option>
            <option value="dispensado">Dispensado</option>
          </select>
        </Campo>
        <Campo label="Data do aviso" ajuda="Data em que o aviso prévio foi comunicado.">
          <input type="date" name="data_aviso" className={INPUT} />
        </Campo>
        <Campo label="Data de desligamento *" ajuda="Último dia do vínculo.">
          <input type="date" name="data_desligamento" required className={INPUT} />
        </Campo>
        <Campo
          label="Dias trabalhados no mês"
          ajuda="Dias do mês corrente até o desligamento (pro-rata de salário)."
        >
          <input type="number" name="dias_trabalhados_mes" min={0} max={31} defaultValue={30} className={INPUT} />
        </Campo>
        <Campo
          label="Meses proporcionais (ano)"
          ajuda="Meses do 13º proporcional no ano do desligamento."
        >
          <input type="number" name="meses_proporcionais" min={0} max={12} defaultValue={0} className={INPUT} />
        </Campo>
        <Campo
          label="Saldo FGTS (p/ multa)"
          ajuda="Saldo do FGTS usado para calcular a multa de 40% (quando aplicável)."
        >
          <input type="number" step="0.01" name="saldo_fgts" min={0} defaultValue={0} className={`${INPUT} font-mono`} />
        </Campo>
        <label className="flex items-center gap-2 text-body-md text-on-surface-variant">
          <input type="checkbox" name="tem_ferias_vencidas" className="rounded text-primary focus:ring-primary" />
          Tem férias vencidas
        </label>
        <Campo label="Motivo" className="md:col-span-3" ajuda="Descrição livre do motivo (interno).">
          <input name="motivo" className={INPUT} />
        </Campo>

        <div className="md:col-span-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={pend}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-error text-on-error text-label-sm uppercase hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">calculate</span>
            {pend ? "Calculando…" : "Calcular e registrar"}
          </button>
          {estado?.erro && <span className="text-label-sm text-error">{estado.erro}</span>}
          {estado?.ok && <span className="text-label-sm text-primary">{estado.mensagem}</span>}
        </div>
      </form>
    </section>
  );
}

function Campo({
  label,
  ajuda,
  className = "",
  children,
}: {
  label: string;
  ajuda?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {ajuda ? (
        <LabelComAjuda ajuda={ajuda}>{label}</LabelComAjuda>
      ) : (
        <label className="text-label-sm text-on-surface-variant">{label}</label>
      )}
      {children}
    </div>
  );
}
