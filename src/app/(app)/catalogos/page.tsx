import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badge: string; icon: string }
> = {
  ok: {
    label: "OK",
    dot: "bg-[#388E3C]",
    badge: "bg-secondary-fixed/30 text-on-secondary-fixed-variant border-secondary-fixed-dim",
    icon: "cloud_done",
  },
  processando: {
    label: "Processando",
    dot: "bg-[#FBC02D]",
    badge: "bg-[#FBC02D]/15 text-[#8a6d00] border-[#FBC02D]",
    icon: "sync",
  },
  executando: {
    label: "Processando",
    dot: "bg-[#FBC02D]",
    badge: "bg-[#FBC02D]/15 text-[#8a6d00] border-[#FBC02D]",
    icon: "sync",
  },
  pendente: {
    label: "Pendente",
    dot: "bg-outline",
    badge: "bg-surface-container text-on-surface-variant border-outline-variant",
    icon: "schedule",
  },
  erro: {
    label: "Erro",
    dot: "bg-error",
    badge: "bg-error-container text-on-error-container border-error",
    icon: "error",
  },
};

export default async function CatalogosPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const filtro = (f ?? "").trim();

  const supabase = await createClient();
  const contexto = await getContextoLoja();
  const ehDono = contexto?.papel === "dono";

  let query = supabase
    .from("catalogos")
    .select("id, slug, nome_exibicao, tipo_fonte, status, produtos_count, imagens_count, ultimo_job_em, erro_resumo")
    .order("produtos_count", { ascending: false });
  if (filtro) query = query.ilike("nome_exibicao", `%${filtro.replace(/[,()%]/g, " ")}%`);

  const { data: catalogos } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg text-primary font-bold">Catálogos na Nuvem</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Fontes consolidadas no catálogo central — {catalogos?.length ?? 0} bases
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action="/catalogos" className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              name="f"
              defaultValue={filtro}
              placeholder="Buscar catálogos..."
              className="pl-10 pr-3 py-2 bg-surface-container-lowest border border-outline-variant rounded text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors w-64"
            />
          </form>
          {ehDono && (
            <Link
              href="/catalogos/upload"
              className="flex items-center gap-2 px-4 py-2.5 rounded bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Novo Catálogo
            </Link>
          )}
        </div>
      </div>

      {!catalogos || catalogos.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg py-16 flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-outline text-5xl">cloud_off</span>
          <p className="text-headline-sm text-on-surface">Nenhum catálogo encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {catalogos.map((c) => {
            const cfg = STATUS_CONFIG[c.status ?? "pendente"] ?? STATUS_CONFIG.pendente;
            return (
              <div
                key={c.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm hover:border-primary transition-colors flex flex-col gap-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-fixed-dim/20 rounded flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">{cfg.icon}</span>
                    </div>
                    <div>
                      <h2 className="text-headline-sm text-on-surface">
                        {c.nome_exibicao ?? c.slug}
                      </h2>
                      <p className="text-label-sm text-on-surface-variant uppercase">
                        {c.tipo_fonte ?? "pdf"} · {c.slug}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-label-sm uppercase ${cfg.badge}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-low rounded p-3">
                    <p className="text-headline-md font-bold text-on-surface font-mono">
                      {(c.produtos_count ?? 0).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-label-sm text-on-surface-variant uppercase">Produtos</p>
                  </div>
                  <div className="bg-surface-container-low rounded p-3">
                    <p className="text-headline-md font-bold text-on-surface font-mono">
                      {(c.imagens_count ?? 0).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-label-sm text-on-surface-variant uppercase">Imagens</p>
                  </div>
                </div>

                {c.status === "erro" && c.erro_resumo && (
                  <p className="text-body-md text-on-error-container bg-error-container/50 border border-error/30 rounded px-3 py-2">
                    {c.erro_resumo}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-outline-variant">
                  <span className="text-label-sm text-on-surface-variant">
                    {c.ultimo_job_em
                      ? `Última sinc.: ${new Date(c.ultimo_job_em).toLocaleDateString("pt-BR")}`
                      : "Nunca sincronizado"}
                  </span>
                  <Link
                    href={`/busca?catalogo=${encodeURIComponent(c.slug)}`}
                    className="flex items-center gap-1 text-label-sm text-primary uppercase hover:underline"
                  >
                    Ver produtos
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
