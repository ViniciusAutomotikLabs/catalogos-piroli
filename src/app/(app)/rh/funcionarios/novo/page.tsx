import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { FormPessoa } from "@/components/pessoas/form-pessoa";
import { criarPessoa } from "@/lib/actions/pessoas";
import { AvisoSemOrganizacaoRH } from "@/components/rh/aviso-sem-org";

/**
 * Cadastro de colaborador dentro do RH.
 * Grava a mesma Pessoa (papel funcionário); após salvar vai para a ficha trabalhista.
 */
export default async function NovoColaboradorRhPage() {
  await requireModulo("rh");
  const contexto = await getContextoLoja();

  if (!contexto?.organizacaoId) return <AvisoSemOrganizacaoRH />;

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
        <Link href="/rh" className="hover:text-primary hover:underline">
          RH
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/rh/funcionarios" className="hover:text-primary hover:underline">
          Funcionários
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold">Novo colaborador</span>
      </nav>

      <FormPessoa
        action={criarPessoa}
        organizacaoId={contexto.organizacaoId}
        pessoa={{ papeis: [{ papel: "funcionario" }] }}
        grupos={(grupos as { id: number; nome: string }[] | null) ?? []}
        cancelHref="/rh/funcionarios"
        redirectTo="rh"
        modoColaborador
        submitLabel="Salvar e abrir ficha"
        titulo="Cadastrar colaborador"
        subtitulo="Dados da pessoa → ao salvar, continue na ficha trabalhista (contrato, documentos, folha)"
      />
    </div>
  );
}
