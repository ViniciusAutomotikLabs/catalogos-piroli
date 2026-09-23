"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import type { EstadoFormPessoa } from "@/lib/actions/pessoas";
import { CapturaFoto } from "@/components/pessoas/captura-foto";
import { LabelComAjuda } from "@/components/ui/label-com-ajuda";
import { buscarCep, formatarCep, normalizarCep } from "@/lib/cep";

// ===== Tipos e catálogos =====

export const PAPEIS = [
  { valor: "cliente", label: "Cliente" },
  { valor: "fornecedor", label: "Fornecedor" },
  { valor: "vendedor", label: "Vendedor" },
  { valor: "funcionario", label: "Funcionário" },
  { valor: "entregador", label: "Entregador" },
  { valor: "oficina", label: "Oficina" },
  { valor: "mecanico", label: "Mecânico" },
] as const;

const CANAIS = [
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "email", label: "E-mail" },
  { valor: "sms", label: "SMS" },
] as const;

type Papel = { papel: string; papel_custom?: string | null };
type GrupoSel = {
  grupo_comercial_id?: number | null;
  grupo_custom?: string | null;
};
type Contato = {
  canal: string;
  valor: string;
  rotulo?: string | null;
  recebe_fechamento: boolean;
  recebe_cobranca: boolean;
};
type Endereco = {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  principal: boolean;
};
type Veiculo = {
  placa?: string | null;
  veiculo?: string | null;
  marca?: string | null;
  ano?: string | null;
  chassi?: string | null;
};

export type PessoaFormValues = {
  id?: number;
  tipo_pessoa?: "PF" | "PJ";
  nome?: string;
  nome_fantasia?: string | null;
  /** Documento em claro só é enviado ao servidor; nunca vem preenchido na edição. */
  documento?: string | null;
  documento_mascara?: string | null;
  foto_url?: string | null;
  situacao?: "ativo" | "inativo";
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  codigo_interno?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  papeis?: Papel[];
  grupos?: GrupoSel[];
  contatos?: Contato[];
  enderecos?: Endereco[];
  veiculos?: Veiculo[];
};

type GrupoComercial = { id: number; nome: string };

type Props = {
  action: (estado: EstadoFormPessoa, formData: FormData) => Promise<EstadoFormPessoa>;
  organizacaoId: number;
  pessoa?: PessoaFormValues;
  grupos?: GrupoComercial[];
  cancelHref: string;
  submitLabel: string;
  titulo?: string;
  subtitulo?: string;
  /** Whitelist no server: só "rh". */
  redirectTo?: "rh";
  /** Cadastro pelo RH: papel funcionário obrigatório (não dá para desmarcar). */
  modoColaborador?: boolean;
};

const INPUT =
  "px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors";

const CHIP =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant hover:border-primary cursor-pointer transition-colors text-label-sm has-checked:border-primary has-checked:bg-primary-fixed/30";

export function FormPessoa({
  action,
  organizacaoId,
  pessoa,
  grupos = [],
  cancelHref,
  submitLabel,
  titulo,
  subtitulo,
  redirectTo,
  modoColaborador = false,
}: Props) {
  const [estado, formAction, pendente] = useActionState<EstadoFormPessoa, FormData>(action, null);

  const [tipoPessoa, setTipoPessoa] = useState<"PF" | "PJ">(pessoa?.tipo_pessoa ?? "PF");
  const [papeis, setPapeis] = useState<Papel[]>(() => {
    const inicial = pessoa?.papeis ?? (modoColaborador ? [{ papel: "funcionario" }] : [{ papel: "cliente" }]);
    if (modoColaborador && !inicial.some((p) => p.papel === "funcionario")) {
      return [...inicial, { papel: "funcionario" }];
    }
    return inicial;
  });
  const [gruposSel, setGruposSel] = useState<GrupoSel[]>(pessoa?.grupos ?? []);
  const [draftPapelCustom, setDraftPapelCustom] = useState("");
  const [draftGrupoCustom, setDraftGrupoCustom] = useState("");
  const [mostrarOutroPapel, setMostrarOutroPapel] = useState(
    () => (pessoa?.papeis ?? []).some((p) => p.papel === "custom")
  );
  const [mostrarOutroGrupo, setMostrarOutroGrupo] = useState(
    () => (pessoa?.grupos ?? []).some((g) => !!g.grupo_custom)
  );
  const [contatos, setContatos] = useState<Contato[]>(
    pessoa?.contatos ?? [{ canal: "whatsapp", valor: "", recebe_fechamento: false, recebe_cobranca: false }]
  );
  const [enderecos, setEnderecos] = useState<Endereco[]>(pessoa?.enderecos ?? []);
  const [veiculos, setVeiculos] = useState<Veiculo[]>(pessoa?.veiculos ?? []);
  const [ieIsenta, setIeIsenta] = useState(
    () => (pessoa?.inscricao_estadual ?? "").toUpperCase() === "ISENTO"
  );

  const papeisFixos = papeis.filter((p) => p.papel !== "custom");
  const papeisCustom = papeis.filter((p) => p.papel === "custom" && p.papel_custom);
  const gruposCatalogo = gruposSel.filter((g) => g.grupo_comercial_id != null);
  const gruposCustom = gruposSel.filter((g) => !!g.grupo_custom);

  function togglePapelFixo(valor: string, checked: boolean) {
    if (modoColaborador && valor === "funcionario" && !checked) return;
    setPapeis((prev) => {
      const customs = prev.filter((p) => p.papel === "custom");
      const fixos = prev.filter((p) => p.papel !== "custom");
      if (checked) return [...fixos, { papel: valor }, ...customs];
      return [...fixos.filter((p) => p.papel !== valor), ...customs];
    });
  }

  function adicionarPapelCustom(texto: string) {
    const nome = texto.trim().slice(0, 60);
    if (!nome) return;
    setPapeis((prev) => {
      const jaExiste = prev.some(
        (p) => p.papel === "custom" && (p.papel_custom ?? "").toLowerCase() === nome.toLowerCase()
      );
      if (jaExiste) return prev;
      return [...prev, { papel: "custom", papel_custom: nome }];
    });
    setDraftPapelCustom("");
  }

  function removerPapelCustom(nome: string) {
    setPapeis((prev) =>
      prev.filter((p) => !(p.papel === "custom" && (p.papel_custom ?? "") === nome))
    );
  }

  function toggleGrupoCatalogo(id: number, checked: boolean) {
    setGruposSel((prev) => {
      if (checked) {
        if (prev.some((g) => g.grupo_comercial_id === id)) return prev;
        return [...prev, { grupo_comercial_id: id, grupo_custom: null }];
      }
      return prev.filter((g) => g.grupo_comercial_id !== id);
    });
  }

  function adicionarGrupoCustom(texto: string) {
    const nome = texto.trim().slice(0, 120);
    if (!nome) return;
    setGruposSel((prev) => {
      const jaExiste = prev.some(
        (g) => (g.grupo_custom ?? "").toLowerCase() === nome.toLowerCase()
      );
      if (jaExiste) return prev;
      return [...prev, { grupo_comercial_id: null, grupo_custom: nome }];
    });
    setDraftGrupoCustom("");
  }

  function removerGrupoCustom(nome: string) {
    setGruposSel((prev) => prev.filter((g) => (g.grupo_custom ?? "") !== nome));
  }

  const papelAtivo = (valor: string) => papeisFixos.some((p) => p.papel === valor);
  const grupoAtivo = (id: number) => gruposCatalogo.some((g) => g.grupo_comercial_id === id);

  return (
    <div className="space-y-6 max-w-4xl">
      {(titulo || subtitulo) && (
        <div>
          {titulo && <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">{titulo}</h1>}
          {subtitulo && <p className="text-body-md text-on-surface-variant mt-1">{subtitulo}</p>}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {pessoa?.id && <input type="hidden" name="id" value={pessoa.id} />}
        {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}

        <input type="hidden" name="papeis" value={JSON.stringify(papeis)} readOnly />
        <input type="hidden" name="grupos" value={JSON.stringify(gruposSel)} readOnly />
        <input type="hidden" name="contatos" value={JSON.stringify(contatos)} readOnly />
        <input type="hidden" name="enderecos" value={JSON.stringify(enderecos)} readOnly />
        <input type="hidden" name="veiculos" value={JSON.stringify(veiculos)} readOnly />

        {/* ===== Dados básicos ===== */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">badge</span>
            Dados Básicos
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {(["PF", "PJ"] as const).map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 px-4 py-2 rounded border border-outline-variant hover:border-primary cursor-pointer transition-colors text-body-md has-checked:border-primary has-checked:bg-primary-fixed/30"
                  >
                    <input
                      type="radio"
                      name="tipo_pessoa"
                      value={t}
                      checked={tipoPessoa === t}
                      onChange={() => setTipoPessoa(t)}
                      className="text-primary focus:ring-primary"
                    />
                    {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </label>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-label-sm text-on-surface-variant" htmlFor="nome">
                  {tipoPessoa === "PF" ? "Nome completo *" : "Razão social *"}
                </label>
                <input id="nome" name="nome" required defaultValue={pessoa?.nome ?? ""} className={INPUT} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-label-sm text-on-surface-variant" htmlFor="nome_fantasia">
                  {tipoPessoa === "PF" ? "Apelido" : "Nome fantasia"}
                </label>
                <input
                  id="nome_fantasia"
                  name="nome_fantasia"
                  defaultValue={pessoa?.nome_fantasia ?? ""}
                  className={INPUT}
                />
              </div>

              <div className="flex flex-col gap-2">
                <LabelComAjuda ajuda="CPF (pessoa física) ou CNPJ (pessoa jurídica). Armazenado cifrado; buscável por índice cego.">
                  {tipoPessoa === "PF" ? "CPF" : "CNPJ"}
                  {pessoa?.id && (
                    <span className="ml-2 text-outline font-normal">
                      (atual: {pessoa?.documento_mascara ?? "—"} · digite para alterar)
                    </span>
                  )}
                </LabelComAjuda>
                <input
                  id="documento"
                  name="documento"
                  defaultValue=""
                  placeholder={tipoPessoa === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
                  className={`${INPUT} font-mono text-code-md`}
                  autoComplete="off"
                />
                <p className="text-label-sm text-outline">Armazenado cifrado (AES-256). Buscável por índice cego.</p>
              </div>

              <div className="flex flex-col gap-2">
                <LabelComAjuda ajuda="Condições comerciais desta pessoa (pode marcar vários). Use Outro… para criar um grupo livre.">
                  Grupo comercial
                </LabelComAjuda>
                <div className="flex items-center gap-2 flex-wrap">
                  {grupos.map((g) => (
                    <label key={g.id} className={CHIP}>
                      <input
                        type="checkbox"
                        checked={grupoAtivo(g.id)}
                        onChange={(e) => toggleGrupoCatalogo(g.id, e.target.checked)}
                        className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                      {g.nome}
                    </label>
                  ))}
                  <label className={CHIP}>
                    <input
                      type="checkbox"
                      checked={mostrarOutroGrupo || gruposCustom.length > 0}
                      onChange={(e) => {
                        setMostrarOutroGrupo(e.target.checked);
                        if (!e.target.checked) {
                          setGruposSel((prev) => prev.filter((g) => !g.grupo_custom));
                          setDraftGrupoCustom("");
                        }
                      }}
                      className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    Outro…
                  </label>
                </div>
                {gruposCustom.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {gruposCustom.map((g) => (
                      <span
                        key={g.grupo_custom!}
                        className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed/30 border border-primary/40 text-label-sm"
                      >
                        {g.grupo_custom}
                        <button
                          type="button"
                          onClick={() => removerGrupoCustom(g.grupo_custom!)}
                          className="text-primary hover:text-error"
                          aria-label={`Remover grupo ${g.grupo_custom}`}
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {(mostrarOutroGrupo || gruposCustom.length > 0) && (
                  <input
                    placeholder="Nome do grupo (Enter para adicionar)"
                    value={draftGrupoCustom}
                    onChange={(e) => setDraftGrupoCustom(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        adicionarGrupoCustom(draftGrupoCustom);
                      }
                    }}
                    className={`${INPUT} mt-2 max-w-xs`}
                  />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <LabelComAjuda ajuda="Ativo aparece nas buscas e listas; inativo fica oculto no uso diário.">
                  Situação
                </LabelComAjuda>
                <select
                  id="situacao"
                  name="situacao"
                  defaultValue={pessoa?.situacao ?? "ativo"}
                  className={INPUT}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div>
              <p className="text-label-sm text-on-surface-variant mb-2">Foto</p>
              <CapturaFoto organizacaoId={organizacaoId} valorInicial={pessoa?.foto_url ?? null} />
            </div>
          </div>
        </section>

        {tipoPessoa === "PJ" && (
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">apartment</span>
              Dados da empresa
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <LabelComAjuda ajuda="Inscrição estadual no cadastro de contribuinte. Marque Isenta se a empresa não possui IE.">
                  Inscrição estadual (IE)
                </LabelComAjuda>
                <input
                  name="inscricao_estadual"
                  defaultValue={
                    (pessoa?.inscricao_estadual ?? "").toUpperCase() === "ISENTO"
                      ? ""
                      : (pessoa?.inscricao_estadual ?? "")
                  }
                  disabled={ieIsenta}
                  className={INPUT}
                  placeholder="Somente números"
                />
                <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    name="ie_isenta"
                    checked={ieIsenta}
                    onChange={(e) => setIeIsenta(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  IE isenta
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <LabelComAjuda ajuda="Inscrição municipal (ISS), quando aplicável.">
                  Inscrição municipal (IM)
                </LabelComAjuda>
                <input
                  name="inscricao_municipal"
                  defaultValue={pessoa?.inscricao_municipal ?? ""}
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col gap-2">
                <LabelComAjuda ajuda="Código legado do sistema anterior (ex.: SS Plus) ou código interno da loja.">
                  Código interno
                </LabelComAjuda>
                <input
                  name="codigo_interno"
                  defaultValue={pessoa?.codigo_interno ?? ""}
                  placeholder="Ex.: 0042"
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col gap-2">
                <LabelComAjuda ajuda="Pessoa de contato principal na empresa (balcão / telefone).">
                  Responsável
                </LabelComAjuda>
                <input
                  name="responsavel"
                  defaultValue={pessoa?.responsavel ?? ""}
                  placeholder="Nome do contato principal"
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <LabelComAjuda ajuda="Notas comerciais: prazo, preferência de entrega, observações internas.">
                  Observações
                </LabelComAjuda>
                <textarea
                  name="observacoes"
                  defaultValue={pessoa?.observacoes ?? ""}
                  rows={2}
                  className={INPUT}
                />
              </div>
            </div>
          </section>
        )}

        {/* ===== Papéis ===== */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">groups</span>
            <LabelComAjuda ajuda="Uma pessoa pode ter vários papéis (cliente e oficina, por exemplo). Funcionário libera a ficha no RH.">
              Papéis
            </LabelComAjuda>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {PAPEIS.map((p) => (
              <label key={p.valor} className={CHIP}>
                <input
                  type="checkbox"
                  checked={papelAtivo(p.valor)}
                  disabled={modoColaborador && p.valor === "funcionario"}
                  onChange={(e) => togglePapelFixo(p.valor, e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-3.5 h-3.5 disabled:opacity-60"
                />
                {p.label}
              </label>
            ))}
            <label className={CHIP}>
              <input
                type="checkbox"
                checked={mostrarOutroPapel || papeisCustom.length > 0}
                onChange={(e) => {
                  setMostrarOutroPapel(e.target.checked);
                  if (!e.target.checked) {
                    setPapeis((prev) => prev.filter((p) => p.papel !== "custom"));
                    setDraftPapelCustom("");
                  }
                }}
                className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
              />
              Outro…
            </label>
          </div>
          {papeisCustom.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {papeisCustom.map((p) => (
                <span
                  key={p.papel_custom!}
                  className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed/30 border border-primary/40 text-label-sm"
                >
                  {p.papel_custom}
                  <button
                    type="button"
                    onClick={() => removerPapelCustom(p.papel_custom!)}
                    className="text-primary hover:text-error"
                    aria-label={`Remover papel ${p.papel_custom}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}
          {(mostrarOutroPapel || papeisCustom.length > 0) && (
            <input
              placeholder="Descreva o papel (Enter para adicionar)"
              value={draftPapelCustom}
              onChange={(e) => setDraftPapelCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  adicionarPapelCustom(draftPapelCustom);
                }
              }}
              className={`${INPUT} mt-3 max-w-xs`}
            />
          )}
          {papelAtivo("funcionario") && (
            <div className="mt-4 flex items-center gap-3 bg-primary-fixed/20 border border-primary/30 rounded-lg px-4 py-3">
              <span className="material-symbols-outlined text-primary">diversity_3</span>
              <p className="text-body-md text-on-surface flex-1">
                {modoColaborador && !pessoa?.id
                  ? "Ao salvar, você segue direto para a ficha trabalhista (contrato, documentos, folha)."
                  : pessoa?.id
                    ? "A ficha trabalhista (salário, férias, folha) é gerenciada no módulo RH."
                    : "Após salvar, gerencie a ficha trabalhista deste funcionário no módulo RH."}
              </p>
              {pessoa?.id && (
                <Link
                  href={`/rh/funcionarios/${pessoa.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  Gerenciar no RH
                </Link>
              )}
            </div>
          )}
        </section>

        <RepetivelContatos contatos={contatos} setContatos={setContatos} />
        <RepetivelEnderecos enderecos={enderecos} setEnderecos={setEnderecos} />
        <RepetivelVeiculos veiculos={veiculos} setVeiculos={setVeiculos} />

        {estado?.erro && (
          <p className="text-body-md text-error bg-error-container/50 border border-error/30 rounded px-3 py-2">
            {estado.erro}
          </p>
        )}
        {estado?.ok && (
          <p className="text-body-md text-on-secondary-container bg-secondary-fixed/30 border border-secondary-fixed-dim rounded px-3 py-2">
            {estado.mensagem ?? "Dados salvos com sucesso."}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href={cancelHref}
            className="px-5 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pendente}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {pendente ? "Salvando…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

// ===== Subcomponentes repetíveis =====

function RepetivelContatos({
  contatos,
  setContatos,
}: {
  contatos: Contato[];
  setContatos: React.Dispatch<React.SetStateAction<Contato[]>>;
}) {
  function atualizar(i: number, patch: Partial<Contato>) {
    setContatos((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-headline-sm text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">contacts</span>
          Contatos
        </h2>
        <button
          type="button"
          onClick={() =>
            setContatos((prev) => [
              ...prev,
              { canal: "whatsapp", valor: "", recebe_fechamento: false, recebe_cobranca: false },
            ])
          }
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant text-primary hover:border-primary text-label-sm uppercase"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>Adicionar
        </button>
      </div>
      <div className="space-y-3">
        {contatos.map((c, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <select
              value={c.canal}
              onChange={(e) => atualizar(i, { canal: e.target.value })}
              className={`${INPUT} md:col-span-2`}
            >
              {CANAIS.map((k) => (
                <option key={k.valor} value={k.valor}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              value={c.valor}
              onChange={(e) => atualizar(i, { valor: e.target.value })}
              placeholder={c.canal === "email" ? "contato@email.com" : "(11) 90000-0000"}
              className={`${INPUT} md:col-span-3`}
            />
            <input
              value={c.rotulo ?? ""}
              onChange={(e) => atualizar(i, { rotulo: e.target.value })}
              placeholder="Rótulo (comercial…)"
              className={`${INPUT} md:col-span-3`}
            />
            <label className="md:col-span-2 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={c.recebe_fechamento}
                onChange={(e) => atualizar(i, { recebe_fechamento: e.target.checked })}
                className="rounded text-primary focus:ring-primary"
              />
              Fechamento
            </label>
            <label className="md:col-span-1 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={c.recebe_cobranca}
                onChange={(e) => atualizar(i, { recebe_cobranca: e.target.checked })}
                className="rounded text-primary focus:ring-primary"
              />
              Cobrança
            </label>
            <button
              type="button"
              onClick={() => setContatos((prev) => prev.filter((_, idx) => idx !== i))}
              className="md:col-span-1 text-error hover:bg-error-container/40 rounded p-1.5 justify-self-start"
              aria-label="Remover contato"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        ))}
        {contatos.length === 0 && (
          <p className="text-body-md text-on-surface-variant">Nenhum contato. Clique em Adicionar.</p>
        )}
      </div>
    </section>
  );
}

function RepetivelEnderecos({
  enderecos,
  setEnderecos,
}: {
  enderecos: Endereco[];
  setEnderecos: React.Dispatch<React.SetStateAction<Endereco[]>>;
}) {
  const [cepStatus, setCepStatus] = useState<Record<number, "idle" | "loading" | "ok" | "erro">>({});
  const lastLookup = useRef<Record<number, string>>({});

  function atualizar(i: number, patch: Partial<Endereco>) {
    setEnderecos((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  async function consultarCep(i: number, cepRaw: string) {
    const digits = normalizarCep(cepRaw);
    if (digits.length !== 8) return;
    if (lastLookup.current[i] === digits) return;
    lastLookup.current[i] = digits;
    setCepStatus((s) => ({ ...s, [i]: "loading" }));
    try {
      const end = await buscarCep(digits);
      if (!end) {
        setCepStatus((s) => ({ ...s, [i]: "erro" }));
        return;
      }
      atualizar(i, {
        cep: end.cep,
        logradouro: end.logradouro || undefined,
        bairro: end.bairro || undefined,
        cidade: end.cidade || undefined,
        uf: end.uf || undefined,
      });
      setCepStatus((s) => ({ ...s, [i]: "ok" }));
    } catch {
      setCepStatus((s) => ({ ...s, [i]: "erro" }));
    }
  }

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-headline-sm text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">location_on</span>
          <LabelComAjuda ajuda="Digite o CEP (8 dígitos) para preencher logradouro, bairro, cidade e UF automaticamente. Número e complemento ficam para você.">
            Endereços
          </LabelComAjuda>
        </h2>
        <button
          type="button"
          onClick={() => setEnderecos((prev) => [...prev, { principal: prev.length === 0 }])}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant text-primary hover:border-primary text-label-sm uppercase"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>Adicionar
        </button>
      </div>
      <div className="space-y-4">
        {enderecos.map((e, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-3 border-b border-outline-variant pb-4 last:border-0">
            <div className="md:col-span-2 flex flex-col gap-1">
              <input
                value={e.cep ?? ""}
                onChange={(ev) => {
                  const formatado = formatarCep(ev.target.value);
                  atualizar(i, { cep: formatado });
                  if (normalizarCep(formatado).length === 8) {
                    void consultarCep(i, formatado);
                  } else {
                    setCepStatus((s) => ({ ...s, [i]: "idle" }));
                  }
                }}
                onBlur={(ev) => void consultarCep(i, ev.target.value)}
                placeholder="CEP"
                className={`${INPUT} font-mono text-code-md`}
                inputMode="numeric"
                autoComplete="postal-code"
              />
              {cepStatus[i] === "loading" && (
                <span className="text-label-sm text-outline">Buscando endereço…</span>
              )}
              {cepStatus[i] === "ok" && (
                <span className="text-label-sm text-primary">Endereço preenchido pelo CEP</span>
              )}
              {cepStatus[i] === "erro" && (
                <span className="text-label-sm text-error">CEP não encontrado — preencha manualmente</span>
              )}
            </div>
            <input value={e.logradouro ?? ""} onChange={(ev) => atualizar(i, { logradouro: ev.target.value })} placeholder="Logradouro" className={`${INPUT} md:col-span-4`} />
            <input value={e.numero ?? ""} onChange={(ev) => atualizar(i, { numero: ev.target.value })} placeholder="Nº" className={`${INPUT} md:col-span-1`} />
            <input value={e.complemento ?? ""} onChange={(ev) => atualizar(i, { complemento: ev.target.value })} placeholder="Complemento" className={`${INPUT} md:col-span-2`} />
            <input value={e.bairro ?? ""} onChange={(ev) => atualizar(i, { bairro: ev.target.value })} placeholder="Bairro" className={`${INPUT} md:col-span-3`} />
            <input value={e.cidade ?? ""} onChange={(ev) => atualizar(i, { cidade: ev.target.value })} placeholder="Cidade" className={`${INPUT} md:col-span-4`} />
            <input value={e.uf ?? ""} onChange={(ev) => atualizar(i, { uf: ev.target.value })} placeholder="UF" maxLength={2} className={`${INPUT} md:col-span-1`} />
            <label className="md:col-span-1 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
              <input type="checkbox" checked={e.principal} onChange={(ev) => atualizar(i, { principal: ev.target.checked })} className="rounded text-primary focus:ring-primary" />
              Principal
            </label>
            <button
              type="button"
              onClick={() => setEnderecos((prev) => prev.filter((_, idx) => idx !== i))}
              className="md:col-span-6 text-error hover:bg-error-container/40 rounded p-1.5 justify-self-start text-label-sm flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span> Remover endereço
            </button>
          </div>
        ))}
        {enderecos.length === 0 && (
          <p className="text-body-md text-on-surface-variant">Nenhum endereço cadastrado.</p>
        )}
      </div>
    </section>
  );
}

function RepetivelVeiculos({
  veiculos,
  setVeiculos,
}: {
  veiculos: Veiculo[];
  setVeiculos: React.Dispatch<React.SetStateAction<Veiculo[]>>;
}) {
  function atualizar(i: number, patch: Partial<Veiculo>) {
    setVeiculos((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-headline-sm text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">directions_car</span>
          Veículos
        </h2>
        <button
          type="button"
          onClick={() => setVeiculos((prev) => [...prev, {}])}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant text-primary hover:border-primary text-label-sm uppercase"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>Adicionar
        </button>
      </div>
      <div className="space-y-3">
        {veiculos.map((v, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <input value={v.placa ?? ""} onChange={(e) => atualizar(i, { placa: e.target.value })} placeholder="Placa" className={`${INPUT} md:col-span-2 font-mono text-code-md`} />
            <input value={v.veiculo ?? ""} onChange={(e) => atualizar(i, { veiculo: e.target.value })} placeholder="Modelo" className={`${INPUT} md:col-span-3`} />
            <input value={v.marca ?? ""} onChange={(e) => atualizar(i, { marca: e.target.value })} placeholder="Marca" className={`${INPUT} md:col-span-2`} />
            <input value={v.ano ?? ""} onChange={(e) => atualizar(i, { ano: e.target.value })} placeholder="Ano" className={`${INPUT} md:col-span-2`} />
            <input value={v.chassi ?? ""} onChange={(e) => atualizar(i, { chassi: e.target.value })} placeholder="Chassi (cifrado)" className={`${INPUT} md:col-span-2`} />
            <button
              type="button"
              onClick={() => setVeiculos((prev) => prev.filter((_, idx) => idx !== i))}
              className="md:col-span-1 text-error hover:bg-error-container/40 rounded p-1.5 justify-self-start"
              aria-label="Remover veículo"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        ))}
        {veiculos.length === 0 && (
          <p className="text-body-md text-on-surface-variant">Nenhum veículo cadastrado.</p>
        )}
      </div>
    </section>
  );
}
