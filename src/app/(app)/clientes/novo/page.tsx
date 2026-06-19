"use client";

import Link from "next/link";
import { FormCliente } from "@/components/clientes/form-cliente";
import { criarCliente } from "@/lib/actions/clientes";

const SECOES = [
  { numero: 1, titulo: "Dados Básicos", icone: "badge" },
  { numero: 2, titulo: "Especialização", icone: "build" },
  { numero: 3, titulo: "Localização", icone: "location_on" },
];

export default function NovoClientePage() {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-body-md text-on-surface-variant">
        <Link href="/clientes" className="hover:text-primary hover:underline">
          CRM
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold">Novo Cadastro</span>
      </nav>

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
              <span className="material-symbols-outlined text-outline text-[18px]">chevron_right</span>
            )}
          </div>
        ))}
      </div>

      <FormCliente
        action={criarCliente}
        cancelHref="/clientes"
        submitLabel="Salvar Cadastro"
        titulo="Cadastro de Nova Oficina"
        subtitulo="Dados Básicos → Especialização → Localização"
      />
    </div>
  );
}
