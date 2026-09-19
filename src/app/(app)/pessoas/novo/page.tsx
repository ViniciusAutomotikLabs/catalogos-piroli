import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { FormPessoa } from "@/components/pessoas/form-pessoa";
import { criarPessoa } from "@/lib/actions/pessoas";

export default async function NovaPessoaPage({
  searchParams,
}: {
  searchParams: Promise<{ papel?: string; origem?: string }>;
}) {
  await requireModulo("pessoas");
  const contexto = await getContextoLoja();
  const params = await searchParams;
  const fromRh = params.origem === "rh" || params.papel === "funcionario";
  const papelFuncionario = params.papel === "funcionario";

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
        <Link
          href={fromRh ? "/rh/funcionarios" : "/pessoas"}
          className="hover:text-primary hover:underline"
        >
          {fromRh ? "RH / Funcionários" : "Pessoas"}
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold">
          {papelFuncionario ? "Novo Funcionário" : "Nova Pessoa"}
        </span>
      </nav>

      <FormPessoa
        action={criarPessoa}
        organizacaoId={contexto.organizacaoId}
        pessoa={papelFuncionario ? { papeis: [{ papel: "funcionario" }] } : undefined}
        grupos={(grupos as { id: number; nome: string }[] | null) ?? []}
        cancelHref={fromRh ? "/rh/funcionarios" : "/pessoas"}
        redirectTo={fromRh ? "rh" : undefined}
        submitLabel="Salvar Cadastro"
        titulo={papelFuncionario ? "Cadastro de Funcionário" : "Cadastro de Pessoa"}
        subtitulo="Dados básicos → Papéis → Contatos → Endereços → Veículos"
      />
    </div>
  );
}
