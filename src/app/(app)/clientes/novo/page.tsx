"use client";

import Link from "next/link";
import { useActionState } from "react";
import { criarCliente, type EstadoFormCliente } from "@/lib/actions/clientes";

const MARCAS = ["Fiat", "Volkswagen", "Chevrolet", "Ford", "Jeep", "Toyota", "Hyundai", "Renault", "Honda", "Grupo Stellantis"];

const SECOES = [
  { numero: 1, titulo: "Dados Básicos", icone: "badge" },
  { numero: 2, titulo: "Especialização", icone: "build" },
  { numero: 3, titulo: "Localização", icone: "location_on" },
];

export default function NovoClientePage() {
  const [estado, formAction, pendente] = useActionState<EstadoFormCliente, FormData>(
    criarCliente,
    null
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <nav className="flex items-center gap-2 text-body-md text-on-surface-variant">
        <Link href="/clientes" className="hover:text-primary hover:underline">
          CRM
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold">Novo Cadastro</span>
      </nav>

      <div>
        <h1 className="text-headline-lg text-primary font-bold">Cadastro de Nova Oficina</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Dados Básicos → Especialização → Localização
        </p>
      </div>

      {/* Stepper visual */}
      <div className="flex items-center gap-2">
        {SECOES.map((s, i) => (
          <div key={s.numero} className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-fixed/40 border border-primary/30">
              <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-label-sm flex items-center justify-center">
                {s.numero}
              </span>
              <span className="text-label-sm text-primary uppercase">{s.titulo}</span>
            </div>
            {i < SECOES.length - 1 && (
              <span className="material-symbols-outlined text-outline text-[18px]">
                chevron_right
              </span>
            )}
          </div>
        ))}
      </div>

      <form action={formAction} className="space-y-6">
        {/* Seção 1 — Dados básicos */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
          <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">badge</span>
            1. Dados Básicos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="CNPJ" name="cnpj" placeholder="00.000.000/0000-00" mono />
            <Campo label="Razão Social *" name="razao_social" required placeholder="Auto Center Silva LTDA" />
            <Campo label="Nome Fantasia" name="nome_fantasia" placeholder="Oficina do Silva" />
            <Campo label="Responsável / Contato" name="contato_nome" placeholder="João Silva" />
            <Campo label="Telefone / WhatsApp" name="telefone_whatsapp" placeholder="(11) 99999-0000" mono />
            <Campo label="E-mail" name="email" type="email" placeholder="contato@oficina.com.br" />
          </div>
        </section>

        {/* Seção 2 — Especialização */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
          <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">build</span>
            2. Especialização
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-label-sm text-on-surface-variant mb-2">Perfil da oficina</p>
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  ["multimarcas", "Multimarcas"],
                  ["especializada", "Especializada"],
                  ["linha_pesada", "Linha Pesada"],
                ].map(([valor, label], i) => (
                  <label
                    key={valor}
                    className="flex items-center gap-2 px-4 py-2 rounded border border-outline-variant hover:border-primary cursor-pointer transition-colors text-body-md has-checked:border-primary has-checked:bg-primary-fixed/30"
                  >
                    <input
                      type="radio"
                      name="especialidade"
                      value={valor}
                      defaultChecked={i === 0}
                      className="text-primary focus:ring-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant mb-2">
                Marcas atendidas (opcional)
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {MARCAS.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant hover:border-primary cursor-pointer transition-colors text-label-sm has-checked:border-primary has-checked:bg-primary-fixed/30"
                  >
                    <input
                      type="checkbox"
                      name="marcas"
                      value={m}
                      className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Seção 3 — Localização */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
          <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">location_on</span>
            3. Localização
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <Campo label="CEP" name="cep" placeholder="00000-000" mono />
            </div>
            <div className="md:col-span-4">
              <Campo label="Logradouro" name="logradouro" placeholder="Rua das Autopeças" />
            </div>
            <div className="md:col-span-1">
              <Campo label="Número" name="numero" placeholder="123" />
            </div>
            <div className="md:col-span-2">
              <Campo label="Complemento" name="complemento" placeholder="Galpão 2" />
            </div>
            <div className="md:col-span-3">
              <Campo label="Bairro" name="bairro" placeholder="Centro" />
            </div>
            <div className="md:col-span-4">
              <Campo label="Cidade" name="cidade" placeholder="São Paulo" />
            </div>
            <div className="md:col-span-2">
              <Campo label="UF" name="uf" placeholder="SP" maxLength={2} />
            </div>
          </div>
        </section>

        {estado?.erro && (
          <p className="text-body-md text-error bg-error-container/50 border border-error/30 rounded px-3 py-2">
            {estado.erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/clientes"
            className="px-5 py-2.5 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm uppercase"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pendente}
            className="flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {pendente ? "Salvando…" : "Salvar Cadastro"}
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
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  mono?: boolean;
  maxLength?: number;
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
        className={`px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors ${
          mono ? "font-mono text-code-md" : ""
        }`}
      />
    </div>
  );
}
