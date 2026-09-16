"use client";

import { useActionState } from "react";
import { agendarFerias, type EstadoRH } from "@/lib/actions/rh-ferias";

const INPUT =
  "px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors";

export type OpcaoFuncionario = { contratoId: number; nome: string };

export function FormFerias({
  funcionarios,
  contratoIdFixo,
}: {
  funcionarios: OpcaoFuncionario[];
  contratoIdFixo?: number;
}) {
  const [estado, action, pend] = useActionState<EstadoRH, FormData>(agendarFerias, null);

  return (
    <form
      action={action}
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
    >
      {contratoIdFixo ? (
        <input type="hidden" name="contrato_id" value={contratoIdFixo} />
      ) : (
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-label-sm text-on-surface-variant">Funcionário</label>
          <select name="contrato_id" required defaultValue="" className={INPUT}>
            <option value="" disabled>
              Selecione…
            </option>
            {funcionarios.map((f) => (
              <option key={f.contratoId} value={f.contratoId}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm text-on-surface-variant">Início do gozo</label>
        <input type="date" name="data_inicio_gozo" className={INPUT} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm text-on-surface-variant">Dias de gozo</label>
        <input type="number" name="dias_gozo" min={1} max={30} defaultValue={30} className={INPUT} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm text-on-surface-variant">Abono (dias)</label>
        <input type="number" name="abono_pecuniario_dias" min={0} max={10} defaultValue={0} className={INPUT} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm text-on-surface-variant">Aquisitivo início</label>
        <input type="date" name="aquisitivo_inicio" className={INPUT} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm text-on-surface-variant">Aquisitivo fim</label>
        <input type="date" name="aquisitivo_fim" className={INPUT} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm text-on-surface-variant">Concessivo até</label>
        <input type="date" name="concessivo_ate" className={INPUT} />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-4">
        <label className="text-label-sm text-on-surface-variant">Observação</label>
        <input name="observacao" className={INPUT} />
      </div>

      <div className="md:col-span-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pend}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">event_available</span>
          {pend ? "Salvando…" : "Agendar férias"}
        </button>
        {estado?.erro && <span className="text-label-sm text-error">{estado.erro}</span>}
        {estado?.ok && <span className="text-label-sm text-primary">{estado.mensagem}</span>}
      </div>
    </form>
  );
}
