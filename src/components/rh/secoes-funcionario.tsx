"use client";

import { useActionState, useTransition } from "react";
import {
  adicionarDocumento,
  removerDocumento,
  adicionarAfastamento,
  removerAfastamento,
  adicionarAdvertencia,
  removerAdvertencia,
  type EstadoRH,
} from "@/lib/actions/rh";
import { UploadArquivo } from "@/components/rh/upload-arquivo";
import { LinkArquivoRh } from "@/components/rh/link-arquivo";
import { LabelComAjuda } from "@/components/ui/label-com-ajuda";
import { BotaoExcluirConfirmado } from "@/components/ui/botao-excluir-confirmado";

const INPUT =
  "px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors";
const BTN =
  "flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors disabled:opacity-60";

export type Documento = { id: number; tipo: string; arquivo_url: string; validade: string | null };
export type Afastamento = {
  id: number;
  tipo: string;
  cid: string | null;
  inicio: string;
  fim: string | null;
  dias: number | null;
  documento_url?: string | null;
};
export type Advertencia = { id: number; tipo: string; motivo: string; data: string };

export function SecoesFuncionario({
  contratoId,
  pessoaId,
  organizacaoId,
  documentos,
  afastamentos,
  advertencias,
}: {
  contratoId: number;
  pessoaId: number;
  organizacaoId: number;
  documentos: Documento[];
  afastamentos: Afastamento[];
  advertencias: Advertencia[];
}) {
  return (
    <div className="space-y-6">
      <Documentos
        contratoId={contratoId}
        pessoaId={pessoaId}
        organizacaoId={organizacaoId}
        itens={documentos}
      />
      <Afastamentos
        contratoId={contratoId}
        pessoaId={pessoaId}
        organizacaoId={organizacaoId}
        itens={afastamentos}
      />
      <Advertencias contratoId={contratoId} pessoaId={pessoaId} itens={advertencias} />
    </div>
  );
}

function Aviso({ estado }: { estado: EstadoRH }) {
  if (!estado) return null;
  if (estado.erro)
    return <p className="text-label-sm text-error bg-error-container/40 rounded px-2 py-1">{estado.erro}</p>;
  if (estado.ok)
    return (
      <p className="text-label-sm text-on-secondary-container bg-secondary-fixed/30 rounded px-2 py-1">
        {estado.mensagem ?? "Salvo."}
      </p>
    );
  return null;
}

function Documentos({
  contratoId,
  pessoaId,
  organizacaoId,
  itens,
}: {
  contratoId: number;
  pessoaId: number;
  organizacaoId: number;
  itens: Documento[];
}) {
  const [estado, action, pend] = useActionState<EstadoRH, FormData>(adicionarDocumento, null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px]">folder</span>
        Documentos
      </h2>

      {itens.length > 0 && (
        <ul className="mb-4 divide-y divide-outline-variant">
          {itens.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-outline text-[18px]">description</span>
                <LinkArquivoRh path={d.arquivo_url}>{d.tipo}</LinkArquivoRh>
                {d.validade && (
                  <span className="text-label-sm text-on-surface-variant">· validade {d.validade}</span>
                )}
              </div>
              <BotaoExcluirConfirmado
                titulo="Excluir documento?"
                descricao="Tem certeza que deseja apagar este documento aqui mesmo?"
                ariaLabel="Remover documento"
                onConfirmar={() => removerDocumento(d.id, pessoaId)}
              />
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="contrato_id" value={contratoId} />
        <input type="hidden" name="pessoa_id" value={pessoaId} />
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Tipo</label>
          <select name="tipo" defaultValue="outro" className={INPUT}>
            <option value="contrato">Contrato</option>
            <option value="aso">ASO</option>
            <option value="rg">RG</option>
            <option value="ctps">CTPS</option>
            <option value="comprovante">Comprovante</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Validade</label>
          <input type="date" name="validade" className={INPUT} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Arquivo</label>
          <UploadArquivo organizacaoId={organizacaoId} pasta="documentos" name="arquivo_url" />
        </div>
        <button type="submit" disabled={pend} className={BTN}>
          <span className="material-symbols-outlined text-[18px]">add</span>Anexar
        </button>
        <Aviso estado={estado} />
      </form>
    </section>
  );
}

function Afastamentos({
  contratoId,
  pessoaId,
  organizacaoId,
  itens,
}: {
  contratoId: number;
  pessoaId: number;
  organizacaoId: number;
  itens: Afastamento[];
}) {
  const [estado, action, pend] = useActionState<EstadoRH, FormData>(adicionarAfastamento, null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px]">healing</span>
        Afastamentos / Atestados
      </h2>

      {itens.length > 0 && (
        <ul className="mb-4 divide-y divide-outline-variant">
          {itens.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <div className="text-body-md text-on-surface">
                <span className="capitalize font-medium">{a.tipo}</span>
                <span className="text-on-surface-variant">
                  {" "}
                  · {a.inicio}
                  {a.fim ? ` → ${a.fim}` : ""}
                  {a.dias ? ` (${a.dias} dias)` : ""}
                  {a.cid ? ` · CID ${a.cid}` : ""}
                </span>
                {a.documento_url && (
                  <span className="ml-2">
                    <LinkArquivoRh path={a.documento_url}>ver atestado</LinkArquivoRh>
                  </span>
                )}
              </div>
              <BotaoExcluirConfirmado
                titulo="Excluir afastamento?"
                descricao="Tem certeza que deseja apagar este afastamento aqui mesmo?"
                ariaLabel="Remover afastamento"
                onConfirmar={() => removerAfastamento(a.id, pessoaId)}
              />
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <input type="hidden" name="contrato_id" value={contratoId} />
        <input type="hidden" name="pessoa_id" value={pessoaId} />
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Tipo</label>
          <select name="tipo" defaultValue="atestado" className={INPUT}>
            <option value="atestado">Atestado</option>
            <option value="inss">INSS</option>
            <option value="licenca">Licença</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <LabelComAjuda ajuda="Código Internacional de Doenças do atestado. Armazenado cifrado (dado de saúde).">
            CID (cifrado)
          </LabelComAjuda>
          <input name="cid" placeholder="ex.: M54" className={INPUT} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Início</label>
          <input type="date" name="inicio" className={INPUT} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Fim</label>
          <input type="date" name="fim" className={INPUT} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Dias</label>
          <input type="number" name="dias" min={0} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Documento</label>
          <UploadArquivo organizacaoId={organizacaoId} pasta="atestados" name="documento_url" />
        </div>
        <div className="md:col-span-6 flex items-center gap-3">
          <button type="submit" disabled={pend} className={BTN}>
            <span className="material-symbols-outlined text-[18px]">add</span>Registrar
          </button>
          <Aviso estado={estado} />
        </div>
      </form>
    </section>
  );
}

function Advertencias({
  contratoId,
  pessoaId,
  itens,
}: {
  contratoId: number;
  pessoaId: number;
  itens: Advertencia[];
}) {
  const [estado, action, pend] = useActionState<EstadoRH, FormData>(adicionarAdvertencia, null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px]">gavel</span>
        Advertências
      </h2>

      {itens.length > 0 && (
        <ul className="mb-4 divide-y divide-outline-variant">
          {itens.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2 gap-3">
              <div className="text-body-md text-on-surface">
                <span className="capitalize font-medium">{a.tipo}</span>
                <span className="text-on-surface-variant"> · {a.data} · {a.motivo}</span>
              </div>
              <BotaoExcluirConfirmado
                titulo="Excluir advertência?"
                descricao="Tem certeza que deseja apagar esta advertência aqui mesmo?"
                ariaLabel="Remover advertência"
                className="text-error hover:bg-error-container/40 rounded p-1 shrink-0"
                onConfirmar={() => removerAdvertencia(a.id, pessoaId)}
              />
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <input type="hidden" name="contrato_id" value={contratoId} />
        <input type="hidden" name="pessoa_id" value={pessoaId} />
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Tipo</label>
          <select name="tipo" defaultValue="escrita" className={INPUT}>
            <option value="verbal">Verbal</option>
            <option value="escrita">Escrita</option>
            <option value="suspensao">Suspensão</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm text-on-surface-variant">Data</label>
          <input type="date" name="data" className={INPUT} required />
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-4">
          <label className="text-label-sm text-on-surface-variant">Motivo</label>
          <input name="motivo" placeholder="Descrição do fato" className={INPUT} required />
        </div>
        <div className="md:col-span-6 flex items-center gap-3">
          <button type="submit" disabled={pend} className={BTN}>
            <span className="material-symbols-outlined text-[18px]">add</span>Registrar
          </button>
          <Aviso estado={estado} />
        </div>
      </form>
    </section>
  );
}
