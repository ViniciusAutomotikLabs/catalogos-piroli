"use client";

import { useActionState, useState } from "react";
import { salvarContrato, type EstadoRH } from "@/lib/actions/rh";

const INPUT =
  "px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors";

const TIPOS_CONTRATO = [
  { valor: "clt", label: "CLT" },
  { valor: "experiencia", label: "Experiência" },
  { valor: "estagio", label: "Estágio" },
  { valor: "temporario", label: "Temporário" },
  { valor: "pj", label: "PJ" },
];

const STATUS = [
  { valor: "ativo", label: "Ativo" },
  { valor: "afastado", label: "Afastado" },
  { valor: "desligado", label: "Desligado" },
];

type Dependente = {
  nome: string;
  nascimento?: string | null;
  parentesco?: string | null;
  para_irrf: boolean;
  para_salario_familia: boolean;
};

export type ContratoValores = {
  matricula?: string | null;
  cargo?: string | null;
  cbo?: string | null;
  departamento?: string | null;
  admissao?: string | null;
  tipo_contrato?: string | null;
  jornada_horas_semana?: number | null;
  salario_base?: string | null;
  dados_bancarios?: string | null;
  sindicato?: string | null;
  status?: string | null;
  desligamento_em?: string | null;
  dependentes?: Dependente[];
};

export function FormContrato({
  pessoaId,
  valores,
}: {
  pessoaId: number;
  valores?: ContratoValores;
}) {
  const [estado, formAction, pendente] = useActionState<EstadoRH, FormData>(salvarContrato, null);
  const [status, setStatus] = useState(valores?.status ?? "ativo");
  const [dependentes, setDependentes] = useState<Dependente[]>(valores?.dependentes ?? []);

  function atualizarDep(i: number, patch: Partial<Dependente>) {
    setDependentes((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="pessoa_id" value={pessoaId} />
      <input type="hidden" name="dependentes" value={JSON.stringify(dependentes)} readOnly />

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
        <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">work</span>
          Ficha Trabalhista
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo label="Matrícula">
            <input name="matricula" defaultValue={valores?.matricula ?? ""} className={INPUT} />
          </Campo>
          <Campo label="Cargo">
            <input name="cargo" defaultValue={valores?.cargo ?? ""} className={INPUT} />
          </Campo>
          <Campo label="CBO">
            <input name="cbo" defaultValue={valores?.cbo ?? ""} className={INPUT} />
          </Campo>
          <Campo label="Departamento">
            <input name="departamento" defaultValue={valores?.departamento ?? ""} className={INPUT} />
          </Campo>
          <Campo label="Admissão">
            <input type="date" name="admissao" defaultValue={valores?.admissao ?? ""} className={INPUT} />
          </Campo>
          <Campo label="Tipo de contrato">
            <select name="tipo_contrato" defaultValue={valores?.tipo_contrato ?? "clt"} className={INPUT}>
              {TIPOS_CONTRATO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Jornada (h/semana)">
            <input
              type="number"
              step="0.5"
              name="jornada_horas_semana"
              defaultValue={valores?.jornada_horas_semana ?? 44}
              className={INPUT}
            />
          </Campo>
          <Campo label="Salário base (R$)" dica="Armazenado cifrado (AES-256).">
            <input
              type="number"
              step="0.01"
              name="salario_base"
              defaultValue={valores?.salario_base ?? ""}
              placeholder="0,00"
              className={`${INPUT} font-mono`}
            />
          </Campo>
          <Campo label="Sindicato">
            <input name="sindicato" defaultValue={valores?.sindicato ?? ""} className={INPUT} />
          </Campo>
          <Campo label="Status">
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={INPUT}
            >
              {STATUS.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.label}
                </option>
              ))}
            </select>
          </Campo>
          {status === "desligado" && (
            <Campo label="Desligamento em">
              <input
                type="date"
                name="desligamento_em"
                defaultValue={valores?.desligamento_em ?? ""}
                className={INPUT}
              />
            </Campo>
          )}
          <Campo label="Dados bancários" dica="Cifrado. Ex.: Banco / Ag / Conta / PIX." className="md:col-span-3">
            <textarea
              name="dados_bancarios"
              defaultValue={valores?.dados_bancarios ?? ""}
              rows={2}
              className={INPUT}
            />
          </Campo>
        </div>
      </section>

      {/* Dependentes */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-headline-sm text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">family_restroom</span>
            Dependentes
          </h2>
          <button
            type="button"
            onClick={() =>
              setDependentes((prev) => [
                ...prev,
                { nome: "", para_irrf: true, para_salario_familia: false },
              ])
            }
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant text-primary hover:border-primary text-label-sm uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>Adicionar
          </button>
        </div>
        <div className="space-y-3">
          {dependentes.map((d, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <input
                value={d.nome}
                onChange={(e) => atualizarDep(i, { nome: e.target.value })}
                placeholder="Nome do dependente"
                className={`${INPUT} md:col-span-4`}
              />
              <input
                type="date"
                value={d.nascimento ?? ""}
                onChange={(e) => atualizarDep(i, { nascimento: e.target.value })}
                className={`${INPUT} md:col-span-2`}
              />
              <input
                value={d.parentesco ?? ""}
                onChange={(e) => atualizarDep(i, { parentesco: e.target.value })}
                placeholder="Parentesco"
                className={`${INPUT} md:col-span-2`}
              />
              <label className="md:col-span-2 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={d.para_irrf}
                  onChange={(e) => atualizarDep(i, { para_irrf: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                IRRF
              </label>
              <label className="md:col-span-1 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={d.para_salario_familia}
                  onChange={(e) => atualizarDep(i, { para_salario_familia: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                Sal.-fam.
              </label>
              <button
                type="button"
                onClick={() => setDependentes((prev) => prev.filter((_, idx) => idx !== i))}
                className="md:col-span-1 text-error hover:bg-error-container/40 rounded p-1.5 justify-self-start"
                aria-label="Remover dependente"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
          {dependentes.length === 0 && (
            <p className="text-body-md text-on-surface-variant">Nenhum dependente cadastrado.</p>
          )}
        </div>
      </section>

      {estado?.erro && (
        <p className="text-body-md text-error bg-error-container/50 border border-error/30 rounded px-3 py-2">
          {estado.erro}
        </p>
      )}
      {estado?.ok && (
        <p className="text-body-md text-on-secondary-container bg-secondary-fixed/30 border border-secondary-fixed-dim rounded px-3 py-2">
          {estado.mensagem ?? "Salvo."}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pendente}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {pendente ? "Salvando…" : "Salvar ficha"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  dica,
  className = "",
  children,
}: {
  label: string;
  dica?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-label-sm text-on-surface-variant">{label}</label>
      {children}
      {dica && <p className="text-label-sm text-outline">{dica}</p>}
    </div>
  );
}
