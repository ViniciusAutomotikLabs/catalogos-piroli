"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EstadoFormCliente } from "@/lib/actions/clientes";

export const MARCAS_CLIENTE = [
  "Fiat",
  "Volkswagen",
  "Chevrolet",
  "Ford",
  "Jeep",
  "Toyota",
  "Hyundai",
  "Renault",
  "Honda",
  "Grupo Stellantis",
];

export type ClienteFormValues = {
  id?: number;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  contato_nome?: string | null;
  telefone_whatsapp?: string | null;
  email?: string | null;
  especialidade?: string | null;
  marcas?: string[] | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  ativo?: boolean;
};

type Props = {
  action: (estado: EstadoFormCliente, formData: FormData) => Promise<EstadoFormCliente>;
  cliente?: ClienteFormValues;
  cancelHref: string;
  submitLabel: string;
  titulo?: string;
  subtitulo?: string;
};

export function FormCliente({
  action,
  cliente,
  cancelHref,
  submitLabel,
  titulo,
  subtitulo,
}: Props) {
  const [estado, formAction, pendente] = useActionState<EstadoFormCliente, FormData>(
    action,
    null
  );
  const marcas = new Set(cliente?.marcas ?? []);
  const especialidade = cliente?.especialidade ?? "multimarcas";

  return (
    <div className="space-y-6 max-w-4xl">
      {(titulo || subtitulo) && (
        <div>
          {titulo && <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">{titulo}</h1>}
          {subtitulo && <p className="text-body-md text-on-surface-variant mt-1">{subtitulo}</p>}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {cliente?.id && <input type="hidden" name="id" value={cliente.id} />}

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">badge</span>
            Dados Básicos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="CNPJ" name="cnpj" defaultValue={cliente?.cnpj} placeholder="00.000.000/0000-00" mono />
            <Campo
              label="Razão Social *"
              name="razao_social"
              required
              defaultValue={cliente?.razao_social}
              placeholder="Auto Center Silva LTDA"
            />
            <Campo
              label="Nome Fantasia"
              name="nome_fantasia"
              defaultValue={cliente?.nome_fantasia}
              placeholder="Oficina do Silva"
            />
            <Campo
              label="Responsável / Contato"
              name="contato_nome"
              defaultValue={cliente?.contato_nome}
              placeholder="João Silva"
            />
            <Campo
              label="Telefone / WhatsApp"
              name="telefone_whatsapp"
              defaultValue={cliente?.telefone_whatsapp}
              placeholder="(11) 99999-0000"
              mono
            />
            <Campo
              label="E-mail"
              name="email"
              type="email"
              defaultValue={cliente?.email}
              placeholder="contato@oficina.com.br"
            />
          </div>
          {cliente && (
            <label className="mt-4 flex items-center gap-2 text-body-md text-on-surface cursor-pointer">
              <input
                type="checkbox"
                name="ativo"
                defaultChecked={cliente.ativo !== false}
                className="rounded border-outline-variant text-primary focus:ring-primary"
              />
              Cliente ativo
            </label>
          )}
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">build</span>
            Especialização
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-label-sm text-on-surface-variant mb-2">Perfil da oficina</p>
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  ["multimarcas", "Multimarcas"],
                  ["especializada", "Especializada"],
                  ["linha_pesada", "Linha Pesada"],
                ].map(([valor, label]) => (
                  <label
                    key={valor}
                    className="flex items-center gap-2 px-4 py-2 rounded border border-outline-variant hover:border-primary cursor-pointer transition-colors text-body-md has-checked:border-primary has-checked:bg-primary-fixed/30"
                  >
                    <input
                      type="radio"
                      name="especialidade"
                      value={valor}
                      defaultChecked={especialidade === valor}
                      className="text-primary focus:ring-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant mb-2">Marcas atendidas (opcional)</p>
              <div className="flex items-center gap-2 flex-wrap">
                {MARCAS_CLIENTE.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant hover:border-primary cursor-pointer transition-colors text-label-sm has-checked:border-primary has-checked:bg-primary-fixed/30"
                  >
                    <input
                      type="checkbox"
                      name="marcas"
                      value={m}
                      defaultChecked={marcas.has(m)}
                      className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">location_on</span>
            Localização
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <Campo label="CEP" name="cep" defaultValue={cliente?.cep} placeholder="00000-000" mono />
            </div>
            <div className="md:col-span-4">
              <Campo label="Logradouro" name="logradouro" defaultValue={cliente?.logradouro} placeholder="Rua das Autopeças" />
            </div>
            <div className="md:col-span-1">
              <Campo label="Número" name="numero" defaultValue={cliente?.numero} placeholder="123" />
            </div>
            <div className="md:col-span-2">
              <Campo label="Complemento" name="complemento" defaultValue={cliente?.complemento} placeholder="Galpão 2" />
            </div>
            <div className="md:col-span-3">
              <Campo label="Bairro" name="bairro" defaultValue={cliente?.bairro} placeholder="Centro" />
            </div>
            <div className="md:col-span-4">
              <Campo label="Cidade" name="cidade" defaultValue={cliente?.cidade} placeholder="São Paulo" />
            </div>
            <div className="md:col-span-2">
              <Campo label="UF" name="uf" defaultValue={cliente?.uf} placeholder="SP" maxLength={2} />
            </div>
          </div>
        </section>

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

function Campo({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
  mono = false,
  maxLength,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  mono?: boolean;
  maxLength?: number;
  defaultValue?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-label-sm text-on-surface-variant" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={defaultValue ?? ""}
        className={`px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors ${
          mono ? "font-mono text-code-md" : ""
        }`}
      />
    </div>
  );
}
