import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { FormPessoa } from "@/components/pessoas/form-pessoa";
import { criarPessoa } from "@/lib/actions/pessoas";

export default async function NovaPessoaPage() {
  await requireModulo("pessoas");
  const contexto = await getContextoLoja();

  if (!contexto?.organizacaoId) {
    return (
      <div className="max-w-2xl mx-auto mt-10 bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center space-y-3">
        <span className="material-symbols-outlined text-primary text-5xl">database</span>
        <h1 className="text-headline-sm text-on-surface">Organização não configurada</h1>
        <p className="text-body-md text-on-surface-variant">
          Aplique as migrations 007–010 e vincule sua loja a uma organização para cadastrar pessoas.
        </p>
        <Link href="/pessoas" className="text-primary hover:underline text-label-sm uppercase">
          Voltar
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;
  const { data: grupos } = await sb
    .from("grupos_comerciais")
    .select("id, nome")
    .eq("organizacao_id", contexto.organizacaoId)
    .order("nome");

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-body-md text-on-surface-variant">
        <Link href="/pessoas" className="hover:text-primary hover:underline">
          Pessoas
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold">Nova Pessoa</span>
      </nav>

      <FormPessoa
        action={criarPessoa}
        organizacaoId={contexto.organizacaoId}
        grupos={(grupos as { id: number; nome: string }[] | null) ?? []}
        cancelHref="/pessoas"
        submitLabel="Salvar Cadastro"
        titulo="Cadastro de Pessoa"
        subtitulo="Dados básicos → Papéis → Contatos → Endereços → Veículos"
      />
    </div>
  );
}
