import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getContextoLoja } from "@/lib/loja";
import { buildContatoLojaUrl } from "@/lib/whatsapp";
import { AdicionarOrcamentoButton } from "@/components/busca/adicionar-orcamento-button";
import { CampoBuscaAutocomplete } from "@/components/busca/campo-busca-autocomplete";
import { OrcamentoStatusChip } from "@/components/dashboard/atalho-orcamento";
import {
  codigoExibicao,
  descricaoOriginalExibicao,
  tituloExibicao,
} from "@/lib/produto-campos";

export default async function DashboardPage() {
  const supabase = await createClient();
  const contexto = await getContextoLoja();

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const [
    { count: catalogosAtivos },
    { data: ultimoCatalogo },
    { count: consultasHoje },
    { data: recentes },
  ] = await Promise.all([
    supabase.from("catalogos").select("id", { count: "exact", head: true }).eq("status", "ok"),
    supabase
      .from("catalogos")
      .select("ultimo_job_em")
      .not("ultimo_job_em", "is", null)
      .order("ultimo_job_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("historico_consultas")
      .select("id", { count: "exact", head: true })
      .gte("criado_em", inicioHoje.toISOString()),
    supabase
      .from("historico_consultas")
      .select(
        "id, termo, criado_em, produtos(id, codigo_produto_interno, codigo_principal, descricao, descricao_original, titulo_normalizado, foto_url, fabricantes(nome_fabricante))"
      )
      .not("produto_id", "is", null)
      .order("criado_em", { ascending: false })
      .limit(6),
  ]);

  const ultimaSync = ultimoCatalogo?.ultimo_job_em
    ? formatarDataRelativa(new Date(ultimoCatalogo.ultimo_job_em))
    : "—";

  const whatsappUrl = buildContatoLojaUrl(contexto?.loja?.telefone_whatsapp);

  return (
    <>
      {/* Hero de busca — compacto, alinhado à esquerda (ação primária do balcão) */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-5 shadow-sm sm:px-6">
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-[18px]">bolt</span>
          <h2 className="text-headline-sm font-bold text-on-surface">
            O que você precisa encontrar?
          </h2>
        </div>
        <form
          action="/busca"
          className="relative mt-3 flex items-center rounded-lg transition-shadow focus-within:ring-2 focus-within:ring-primary"
        >
          <span className="material-symbols-outlined filled pointer-events-none absolute left-4 z-10 text-outline">
            search
          </span>
          <CampoBuscaAutocomplete
            name="q"
            aria-label="Buscar peça por código, descrição ou referência"
            placeholder="Código, descrição ou referência (ex: 201.0813, PH2870A)"
            inputClassName="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low py-3 pl-12 pr-28 font-mono text-code-md text-on-surface placeholder:text-outline focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="absolute right-2 z-10 flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-label-sm uppercase text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </form>
        <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-label-sm text-on-surface-variant">Atalhos:</span>
          <ChipAtalho href="/veiculo" icon="directions_car" label="Buscar por veículo" />
          <ChipAtalho href="/historico" icon="history" label="Últimas consultas" />
          <ChipAtalho href="/catalogos" icon="menu_book" label="Ver catálogos" />
        </div>
      </section>

      {/* Barra de status fina — sync · catálogos · consultas + orçamento em andamento */}
      <section className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-body-md text-on-surface-variant">
          <StatusItem icon="update" label="Sincronização" valor={ultimaSync} />
          <span className="hidden h-4 w-px bg-outline-variant sm:block" />
          <StatusItem
            icon="menu_book"
            label="Catálogos ativos"
            valor={catalogosAtivos ?? 0}
            href="/catalogos"
          />
          <span className="hidden h-4 w-px bg-outline-variant sm:block" />
          <StatusItem icon="query_stats" label="Consultas hoje" valor={consultasHoje ?? 0} />
        </div>
        <OrcamentoStatusChip />
      </section>

      {/* Consultados recentemente — largura total, denso */}
      <section>
        <div className="w-full">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-headline-sm font-bold text-on-surface">Consultados recentemente</h3>
            <Link
              href="/historico"
              className="flex items-center gap-1 rounded-lg px-1 text-label-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Ver histórico
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
            {recentes && recentes.length > 0 ? (
              <ul>
                {recentes.map((r) => {
                  const p = r.produtos;
                  if (!p) return null;
                  const fabricante = p.fabricantes?.nome_fabricante;
                  const titulo = tituloExibicao(p);
                  const codigo = codigoExibicao(p);
                  const textoOriginal = descricaoOriginalExibicao(p);
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 border-b border-outline-variant px-3 py-2.5 transition-colors last:border-0 hover:bg-surface-container-low"
                    >
                      <Link
                        href={`/produtos/${p.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {p.foto_url ? (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-outline-variant bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.foto_url}
                              alt=""
                              className="h-10 w-10 object-contain"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-surface-container-low text-outline-variant"
                            aria-hidden="true"
                          >
                            <span className="material-symbols-outlined text-[18px] opacity-60">
                              image
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className="line-clamp-1 font-semibold text-on-surface"
                            title={textoOriginal || undefined}
                          >
                            {titulo}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-mono text-code-md text-primary">
                              {codigo}
                            </span>
                            {fabricante && (
                              <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                                <span className="h-1 w-1 rounded-full bg-outline-variant" />
                                {fabricante}
                              </span>
                            )}
                            {r.termo && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-label-sm text-on-surface-variant">
                                <span className="material-symbols-outlined text-[13px]">search</span>
                                <span className="max-w-[10rem] truncate">{r.termo}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      <span className="hidden shrink-0 items-center gap-1 text-label-sm text-outline sm:flex">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {formatarTempoRelativo(new Date(r.criado_em))}
                      </span>

                      <div className="flex shrink-0 items-center gap-1">
                        <AdicionarOrcamentoButton
                          item={{
                            produtoId: p.id,
                            codigo,
                            descricao: p.descricao ?? titulo,
                            fabricante,
                            fotoUrl: p.foto_url,
                          }}
                        />
                        <Link
                          href={`/produtos/${p.id}`}
                          aria-label={`Reabrir ${titulo}`}
                          title="Reabrir"
                          className="flex h-8 w-8 items-center justify-center rounded border border-transparent bg-surface-container text-on-surface-variant transition-colors hover:border-primary hover:bg-primary hover:text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[28px]">manage_search</span>
                </span>
                <div>
                  <p className="text-headline-sm font-semibold text-on-surface">
                    Nenhuma consulta ainda
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-body-md text-on-surface-variant">
                    As peças que você abrir a partir da busca aparecem aqui, com o termo
                    pesquisado, para reaproveitar rápido.
                  </p>
                </div>
                <Link
                  href="/busca"
                  className="mt-1 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-label-sm uppercase text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">search</span>
                  Ir para a busca
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Suporte técnico — faixa slim, verde reservado ao WhatsApp */}
      <section className="flex flex-col items-start justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined filled text-[20px]">forum</span>
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-on-surface">Dúvida de compatibilidade?</p>
            <p className="text-body-md text-on-surface-variant">
              Fale com um especialista da loja para confirmar a peça.
            </p>
          </div>
        </div>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2.5 text-label-sm uppercase text-on-secondary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 sm:w-auto"
        >
          <span className="material-symbols-outlined text-[18px]">chat</span>
          Falar no WhatsApp
        </a>
      </section>
    </>
  );
}

/** Chip de atalho do hero (navegação rápida). */
function ChipAtalho({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {label}
    </Link>
  );
}

/** Item da barra de status fina. Opcionalmente vira link. */
function StatusItem({
  icon,
  label,
  valor,
  href,
}: {
  icon: string;
  label: string;
  valor: string | number;
  href?: string;
}) {
  const conteudo = (
    <>
      <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
      <span className="text-on-surface-variant">{label}:</span>
      <span className="font-semibold text-on-surface">{valor}</span>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-1.5 rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {conteudo}
      </Link>
    );
  }
  return <span className="flex items-center gap-1.5">{conteudo}</span>;
}

function formatarDataRelativa(data: Date) {
  const hoje = new Date();
  const mesmaData = data.toDateString() === hoje.toDateString();
  if (mesmaData) return "Hoje";
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-BR");
}

/** Tempo relativo curto para o histórico: "agora", "há 5 min", "há 2 h", "ontem", data. */
function formatarTempoRelativo(data: Date) {
  const diffMs = Date.now() - data.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} d`;
  return data.toLocaleDateString("pt-BR");
}
