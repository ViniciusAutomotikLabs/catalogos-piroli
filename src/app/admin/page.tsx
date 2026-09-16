import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { MODULO_CHAVES } from "@/lib/modulos";
import { ModuloToggle } from "@/components/admin/modulo-toggle";

type LojaRow = {
  id: number;
  nome: string;
  organizacao_id: number | null;
  organizacoes: { nome: string } | null;
};
type ModuloRow = { chave: string; nome: string; ativo_global: boolean };
type LojaModuloRow = { loja_id: number; modulo_chave: string; ativo: boolean };
type MembroRow = { loja_id: number; papel: string };

export default async function AdminPage() {
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseClient;

  const [{ data: lojas }, { data: modulos }, { data: lojaModulos }, { data: membros }] =
    await Promise.all([
      sb.from("lojas").select("id, nome, organizacao_id, organizacoes(nome)").order("id"),
      sb.from("modulos").select("chave, nome, ativo_global"),
      sb.from("loja_modulos").select("loja_id, modulo_chave, ativo"),
      sb.from("membros_loja").select("loja_id, papel"),
    ]);

  const listaLojas = (lojas as LojaRow[] | null) ?? [];
  const catalogo = (modulos as ModuloRow[] | null) ?? [];
  const entitlements = (lojaModulos as LojaModuloRow[] | null) ?? [];
  const listaMembros = (membros as MembroRow[] | null) ?? [];

  // Ordena os módulos pela ordem canônica do catálogo.
  const modulosPorChave = new Map(catalogo.map((m) => [m.chave, m]));
  const modulosOrdenados = MODULO_CHAVES.map((c) => modulosPorChave.get(c)).filter(
    (m): m is ModuloRow => Boolean(m)
  );

  // Entitlements ativos por loja.
  const ativosPorLoja = new Map<number, Set<string>>();
  for (const e of entitlements) {
    if (!e.ativo) continue;
    if (!ativosPorLoja.has(e.loja_id)) ativosPorLoja.set(e.loja_id, new Set());
    ativosPorLoja.get(e.loja_id)!.add(e.modulo_chave);
  }
  const membrosPorLoja = new Map<number, number>();
  for (const m of listaMembros) {
    membrosPorLoja.set(m.loja_id, (membrosPorLoja.get(m.loja_id) ?? 0) + 1);
  }

  const totalOrgs = new Set(listaLojas.map((l) => l.organizacao_id).filter(Boolean)).size;
  const modulosGlobaisAtivos = catalogo.filter((m) => m.ativo_global).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-headline-lg text-on-surface font-bold tracking-tight">Lojas &amp; Módulos</h2>
        <p className="text-body-md text-on-surface-variant mt-1">
          Libere ou corte módulos por loja. Clique num chip para ligar/desligar.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icone="storefront" rotulo="Lojas" valor={listaLojas.length} />
        <Stat icone="apartment" rotulo="Organizações" valor={totalOrgs} />
        <Stat icone="widgets" rotulo="Módulos (catálogo)" valor={catalogo.length} />
        <Stat icone="toggle_on" rotulo="Ativos globalmente" valor={modulosGlobaisAtivos} />
      </div>

      {/* Matriz de lojas */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-high border-b border-outline-variant text-on-surface-variant text-label-sm">
            <tr>
              <th className="px-4 py-3 font-semibold">Loja</th>
              <th className="px-4 py-3 font-semibold">Organização</th>
              <th className="px-4 py-3 w-20 font-semibold">Membros</th>
              <th className="px-4 py-3 font-semibold">Módulos liberados</th>
            </tr>
          </thead>
          <tbody className="text-body-md text-on-surface">
            {listaLojas.map((loja, i) => {
              const ativos = ativosPorLoja.get(loja.id) ?? new Set<string>();
              return (
                <tr
                  key={loja.id}
                  className={`border-b border-outline-variant align-top ${i % 2 === 1 ? "bg-surface-container-low" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold">
                    {loja.nome}
                    <span className="block text-label-sm text-on-surface-variant font-normal font-mono">
                      #{loja.id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {loja.organizacoes?.nome ?? (
                      <span className="text-error text-label-sm">sem organização</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-code-md text-on-surface-variant">
                    {membrosPorLoja.get(loja.id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {modulosOrdenados.map((m) => (
                        <ModuloToggle
                          key={m.chave}
                          lojaId={loja.id}
                          moduloChave={m.chave}
                          moduloNome={m.nome}
                          ativo={ativos.has(m.chave)}
                          globalOff={!m.ativo_global}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {listaLojas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-on-surface-variant">
                  Nenhuma loja encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-label-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-[14px] text-error align-middle">block</span>{" "}
        = módulo desligado globalmente (kill switch): o entitlement da loja não tem efeito até religá-lo.
      </p>
    </div>
  );
}

function Stat({ icone, rotulo, valor }: { icone: string; rotulo: string; valor: number }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <span className="material-symbols-outlined text-[20px] text-primary">{icone}</span>
        <span className="text-label-sm">{rotulo}</span>
      </div>
      <p className="text-headline-lg text-on-surface font-bold mt-1">{valor}</p>
    </div>
  );
}
