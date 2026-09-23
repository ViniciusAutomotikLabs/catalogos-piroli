import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja, requireModulo } from "@/lib/loja";
import { FormPessoa, type PessoaFormValues } from "@/components/pessoas/form-pessoa";
import { atualizarPessoa } from "@/lib/actions/pessoas";
import { BotaoExcluirPessoa } from "@/components/pessoas/botao-excluir-pessoa";
import { decifrar } from "@/lib/crypto";

function safeDecifrar(valor: string | null): string {
  try {
    return decifrar(valor) ?? "";
  } catch {
    return "";
  }
}

export default async function EditarPessoaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModulo("pessoas");
  const contexto = await getContextoLoja();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) notFound();

  if (!contexto?.organizacaoId) notFound();

  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const { data: pessoa } = await sb
    .from("pessoas")
    .select(
      "id, tipo_pessoa, nome, nome_fantasia, documento_mascara, foto_url, situacao, inscricao_estadual, inscricao_municipal, codigo_interno, responsavel, observacoes"
    )
    .eq("id", id)
    .eq("organizacao_id", contexto.organizacaoId)
    .maybeSingle();

  if (!pessoa) notFound();

  const [
    { data: papeis },
    { data: gruposPessoa },
    { data: contatos },
    { data: enderecos },
    { data: veiculos },
    { data: grupos },
  ] = await Promise.all([
    sb.from("pessoa_papeis").select("papel, papel_custom").eq("pessoa_id", id),
    sb
      .from("pessoa_grupos_comerciais")
      .select("grupo_comercial_id, grupo_custom")
      .eq("pessoa_id", id),
    sb
      .from("pessoa_contatos")
      .select("canal, valor_cifrado, rotulo, recebe_fechamento, recebe_cobranca")
      .eq("pessoa_id", id),
    sb
      .from("pessoa_enderecos")
      .select("cep, logradouro, numero, complemento, bairro, cidade, uf, principal")
      .eq("pessoa_id", id),
    sb.from("pessoa_veiculos").select("placa, veiculo, marca, ano, chassi_cifrado").eq("pessoa_id", id),
    sb.from("grupos_comerciais").select("id, nome").eq("organizacao_id", contexto.organizacaoId).order("nome"),
  ]);

  const valores: PessoaFormValues = {
    id: pessoa.id,
    tipo_pessoa: pessoa.tipo_pessoa,
    nome: pessoa.nome,
    nome_fantasia: pessoa.nome_fantasia,
    documento_mascara: pessoa.documento_mascara,
    foto_url: pessoa.foto_url,
    situacao: pessoa.situacao,
    inscricao_estadual: pessoa.inscricao_estadual,
    inscricao_municipal: pessoa.inscricao_municipal,
    codigo_interno: pessoa.codigo_interno,
    responsavel: pessoa.responsavel,
    observacoes: pessoa.observacoes,
    papeis: (papeis ?? []).map((p: { papel: string; papel_custom: string | null }) => ({
      papel: p.papel,
      papel_custom: p.papel_custom,
    })),
    grupos: (gruposPessoa ?? []).map(
      (g: { grupo_comercial_id: number | null; grupo_custom: string | null }) => ({
        grupo_comercial_id: g.grupo_comercial_id,
        grupo_custom: g.grupo_custom,
      })
    ),
    contatos: (contatos ?? []).map(
      (c: {
        canal: string;
        valor_cifrado: string | null;
        rotulo: string | null;
        recebe_fechamento: boolean;
        recebe_cobranca: boolean;
      }) => ({
        canal: c.canal,
        valor: safeDecifrar(c.valor_cifrado),
        rotulo: c.rotulo,
        recebe_fechamento: c.recebe_fechamento,
        recebe_cobranca: c.recebe_cobranca,
      })
    ),
    enderecos: (enderecos ?? []).map((e: Record<string, unknown>) => ({
      cep: (e.cep as string) ?? null,
      logradouro: (e.logradouro as string) ?? null,
      numero: (e.numero as string) ?? null,
      complemento: (e.complemento as string) ?? null,
      bairro: (e.bairro as string) ?? null,
      cidade: (e.cidade as string) ?? null,
      uf: (e.uf as string) ?? null,
      principal: Boolean(e.principal),
    })),
    veiculos: (veiculos ?? []).map(
      (v: { placa: string | null; veiculo: string | null; marca: string | null; ano: string | null; chassi_cifrado: string | null }) => ({
        placa: v.placa,
        veiculo: v.veiculo,
        marca: v.marca,
        ano: v.ano,
        chassi: safeDecifrar(v.chassi_cifrado),
      })
    ),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-body-md text-on-surface-variant">
          <Link href="/pessoas" className="hover:text-primary hover:underline">
            Pessoas
          </Link>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-on-surface font-semibold">{pessoa.nome_fantasia ?? pessoa.nome}</span>
        </nav>
        <BotaoExcluirPessoa
          pessoaId={id}
          nome={String(pessoa.nome_fantasia ?? pessoa.nome)}
        />
      </div>

      <FormPessoa
        action={atualizarPessoa}
        organizacaoId={contexto.organizacaoId}
        pessoa={valores}
        grupos={(grupos as { id: number; nome: string }[] | null) ?? []}
        cancelHref="/pessoas"
        submitLabel="Salvar Alterações"
        titulo="Editar Pessoa"
      />
    </div>
  );
}
