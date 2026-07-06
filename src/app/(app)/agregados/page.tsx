import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listarAgregadosDoProduto } from "@/lib/agregados";
import { FormCadastroAgregados } from "@/components/agregados/form-cadastro";
import { codigoExibicao, tituloExibicao } from "@/lib/produto-campos";

function sanitize(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}

export default async function AgregadosPage({
  searchParams,
}: {
  searchParams: Promise<{ principal?: string; q?: string }>;
}) {
  const params = await searchParams;
  const principalId = parseInt(params.principal ?? "", 10);
  const termo = sanitize(params.q ?? "");

  const supabase = await createClient();

  let principal = null;
  if (!Number.isNaN(principalId)) {
    const { data } = await supabase
      .from("produtos")
      .select(
        "id, codigo_principal, codigo_produto_interno, titulo_normalizado, descricao, foto_url, origem_catalogo"
      )
      .eq("id", principalId)
      .maybeSingle();
    principal = data;
  }

  let candidatos: Array<{
    id: number;
    codigo_principal: string | null;
    codigo_produto_interno: string;
    titulo_normalizado: string | null;
    descricao: string | null;
    origem_catalogo: string;
  }> = [];

  if (!principal && termo.length >= 2) {
    const pattern = `%${termo}%`;
    const { data } = await supabase
      .from("produtos")
      .select(
        "id, codigo_principal, codigo_produto_interno, titulo_normalizado, descricao, origem_catalogo"
      )
      .or(
        `codigo_principal.ilike.${pattern},codigo_produto_interno.ilike.${pattern},titulo_normalizado.ilike.${pattern},descricao.ilike.${pattern}`
      )
      .limit(15);
    candidatos = data ?? [];
  }

  const agregados = principal ? await listarAgregadosDoProduto(principal.id) : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">
          Agregados de montagem
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Cadastre peças complementares (batente, coifa, rolamento…) para exibir na busca e no
          orçamento. Regras <strong>globais</strong> — valem para todas as lojas.
        </p>
      </div>

      {!principal ? (
        <div className="space-y-4">
          <form action="/agregados" className="flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={termo}
              placeholder="Buscar peça principal (ex.: amortecedor, coroa)..."
              className="flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-body-md focus:border-primary focus:ring-2 focus:ring-primary outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container"
            >
              Buscar
            </button>
          </form>

          {termo.length >= 2 && candidatos.length === 0 && (
            <p className="text-body-md text-on-surface-variant">Nenhuma peça encontrada.</p>
          )}

          {candidatos.length > 0 && (
            <ul className="rounded-xl border border-outline-variant bg-surface-container-lowest divide-y divide-outline-variant shadow-sm">
              {candidatos.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/agregados?principal=${p.id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-primary-fixed/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-on-surface line-clamp-1">
                        {tituloExibicao(p)}
                      </p>
                      <p className="font-mono text-code-md text-primary">{codigoExibicao(p)}</p>
                      <p className="text-label-sm text-on-surface-variant uppercase mt-0.5">
                        {p.origem_catalogo}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-primary">chevron_right</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <Link
            href="/agregados"
            className="inline-flex items-center gap-1 text-body-md text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Escolher outra peça principal
          </Link>
          <FormCadastroAgregados principal={principal} agregadosIniciais={agregados} />
        </>
      )}
    </div>
  );
}
