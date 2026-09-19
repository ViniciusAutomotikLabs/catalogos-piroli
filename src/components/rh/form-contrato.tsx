"use client";

import { useActionState, useMemo, useState } from "react";
import { salvarContrato, type EstadoRH } from "@/lib/actions/rh";
import { LabelComAjuda } from "@/components/ui/label-com-ajuda";
import { parseDadosBancarios, type DadosBancarios } from "@/lib/rh/dados-bancarios";

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
  /** String decifrada: JSON novo ou texto legado. */
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
  const bancariosIniciais = useMemo(
    () => parseDadosBancarios(valores?.dados_bancarios),
    [valores?.dados_bancarios]
  );
  const [bancarios, setBancarios] = useState<DadosBancarios>(bancariosIniciais);

  function atualizarDep(i: number, patch: Partial<Dependente>) {
    setDependentes((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function patchBanc(patch: Partial<DadosBancarios>) {
    setBancarios((prev) => ({ ...prev, ...patch }));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="pessoa_id" value={pessoaId} />
      <input type="hidden" name="dependentes" value={JSON.stringify(dependentes)} readOnly />
      <input type="hidden" name="banco" value={bancarios.banco ?? ""} readOnly />
      <input type="hidden" name="agencia" value={bancarios.agencia ?? ""} readOnly />
      <input type="hidden" name="conta" value={bancarios.conta ?? ""} readOnly />
      <input type="hidden" name="tipo_conta" value={bancarios.tipo_conta ?? "corrente"} readOnly />
      <input type="hidden" name="pix" value={bancarios.pix ?? ""} readOnly />

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
        <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">work</span>
          Ficha Trabalhista
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo
            label="Matrícula"
            ajuda="Número interno do funcionário na empresa (folha / ponto)."
          >
            <input name="matricula" defaultValue={valores?.matricula ?? ""} className={INPUT} />
          </Campo>
          <Campo label="Cargo" ajuda="Função exercida (ex.: Gerente, Balconista, Mecânico).">
            <input name="cargo" defaultValue={valores?.cargo ?? ""} className={INPUT} />
          </Campo>
          <Campo
            label="CBO"
            ajuda="Código Brasileiro de Ocupações (MTE). Ex.: 1421-05 para gerente comercial."
          >
            <input name="cbo" defaultValue={valores?.cbo ?? ""} className={INPUT} placeholder="Ex.: 1421-05" />
          </Campo>
          <Campo label="Departamento" ajuda="Área ou setor (ex.: Vendas, Estoque, Administrativo).">
            <input name="departamento" defaultValue={valores?.departamento ?? ""} className={INPUT} />
          </Campo>
          <Campo label="Admissão" ajuda="Data de início do vínculo trabalhista.">
            <input type="date" name="admissao" defaultValue={valores?.admissao ?? ""} className={INPUT} />
          </Campo>
          <Campo label="Tipo de contrato" ajuda="Regime: CLT, experiência, estágio, temporário ou PJ.">
            <select name="tipo_contrato" defaultValue={valores?.tipo_contrato ?? "clt"} className={INPUT}>
              {TIPOS_CONTRATO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Jornada (h/semana)" ajuda="Horas semanais contratadas. Padrão CLT: 44.">
            <input
              type="number"
              step="0.5"
              name="jornada_horas_semana"
              defaultValue={valores?.jornada_horas_semana ?? 44}
              className={INPUT}
            />
          </Campo>
          <Campo
            label="Salário base (R$)"
            ajuda="Salário mensal bruto. Armazenado cifrado (AES-256)."
            dica="Armazenado cifrado (AES-256)."
          >
            <input
              type="number"
              step="0.01"
              name="salario_base"
              defaultValue={valores?.salario_base ?? ""}
              placeholder="0,00"
              className={`${INPUT} font-mono`}
            />
          </Campo>
          <Campo label="Sindicato" ajuda="Nome do sindicato da categoria, se houver.">
            <input name="sindicato" defaultValue={valores?.sindicato ?? ""} className={INPUT} />
          </Campo>
          <Campo label="Status" ajuda="Ativo, afastado ou desligado. Afeta listas e folha.">
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
            <Campo label="Desligamento em" ajuda="Data efetiva do desligamento.">
              <input
                type="date"
                name="desligamento_em"
                defaultValue={valores?.desligamento_em ?? ""}
                className={INPUT}
              />
            </Campo>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-outline-variant">
          <h3 className="text-label-sm text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">account_balance</span>
            Dados bancários
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Campo label="Banco" ajuda="Nome do banco (ex.: Banco do Brasil, Caixa, Nubank).">
              <input
                value={bancarios.banco ?? ""}
                onChange={(e) => patchBanc({ banco: e.target.value })}
                placeholder="Ex.: Banco do Brasil"
                className={INPUT}
              />
            </Campo>
            <Campo label="Agência" ajuda="Número da agência (com dígito, se houver).">
              <input
                value={bancarios.agencia ?? ""}
                onChange={(e) => patchBanc({ agencia: e.target.value })}
                placeholder="0001"
                className={`${INPUT} font-mono`}
              />
            </Campo>
            <Campo label="Conta" ajuda="Número da conta com dígito verificador.">
              <input
                value={bancarios.conta ?? ""}
                onChange={(e) => patchBanc({ conta: e.target.value })}
                placeholder="12345-6"
                className={`${INPUT} font-mono`}
              />
            </Campo>
            <Campo label="Tipo da conta" ajuda="Corrente, poupança ou conta pagamento.">
              <select
                value={bancarios.tipo_conta ?? "corrente"}
                onChange={(e) =>
                  patchBanc({ tipo_conta: e.target.value as DadosBancarios["tipo_conta"] })
                }
                className={INPUT}
              >
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="pagamento">Pagamento</option>
              </select>
            </Campo>
            <Campo
              label="Chave PIX"
              ajuda="CPF, e-mail, telefone ou chave aleatória para pagamento."
              className="md:col-span-2"
              dica="Dados bancários armazenados cifrados (AES-256)."
            >
              <input
                value={bancarios.pix ?? ""}
                onChange={(e) => patchBanc({ pix: e.target.value })}
                placeholder="CPF, e-mail, telefone ou chave"
                className={INPUT}
              />
            </Campo>
          </div>
        </div>
      </section>

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
  ajuda,
  dica,
  className = "",
  children,
}: {
  label: string;
  ajuda?: string;
  dica?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {ajuda ? <LabelComAjuda ajuda={ajuda}>{label}</LabelComAjuda> : (
        <label className="text-label-sm text-on-surface-variant">{label}</label>
      )}
      {children}
      {dica && <p className="text-label-sm text-outline">{dica}</p>}
    </div>
  );
}
