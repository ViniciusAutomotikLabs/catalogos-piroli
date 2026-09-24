import { getContextoLoja } from "@/lib/loja";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sair } from "@/lib/actions/auth";
import { obterSyncLegadoAtivo } from "@/lib/actions/sync-legado";
import { ToggleSyncLegado } from "@/components/configuracoes/toggle-sync-legado";
import { FormConviteMembro } from "@/components/configuracoes/form-convite-membro";
import { ListaMembros } from "@/components/configuracoes/lista-membros";
import { labelPapel } from "@/lib/membros";

async function resolverEmails(
  userIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (userIds.length === 0) return map;
  const admin = createAdminClient();
  if (!admin) return map;

  await Promise.all(
    userIds.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      map.set(id, error ? null : data.user?.email ?? null);
    })
  );
  return map;
}

export default async function ConfiguracoesPage() {
  const contexto = await getContextoLoja();
  const supabase = await createClient();

  const [{ data: membros }, syncAtivo] = await Promise.all([
    supabase
      .from("membros_loja")
      .select("user_id, papel, criado_em")
      .order("criado_em"),
    obterSyncLegadoAtivo(),
  ]);

  const podeGerenciar =
    contexto?.papel === "dono" || Boolean(contexto?.isSuperAdmin);

  const emails = podeGerenciar
    ? await resolverEmails((membros ?? []).map((m) => m.user_id))
    : new Map<string, string | null>();

  const rows = (membros ?? []).map((m) => ({
    user_id: m.user_id,
    papel: m.papel,
    criado_em: m.criado_em,
    email:
      m.user_id === contexto?.user.id
        ? contexto.user.email ?? null
        : emails.get(m.user_id) ?? null,
    isSelf: m.user_id === contexto?.user.id,
  }));

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-headline-lg text-on-surface font-bold tracking-tight">Configurações</h1>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
        <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">storefront</span>
          Loja
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-body-md">
          <div>
            <dt className="text-label-sm text-on-surface-variant">Nome</dt>
            <dd className="font-semibold text-on-surface mt-1">
              {contexto?.loja?.nome ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-label-sm text-on-surface-variant">CNPJ</dt>
            <dd className="font-mono text-code-md text-on-surface mt-1">
              {contexto?.loja?.cnpj ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-label-sm text-on-surface-variant">WhatsApp da loja</dt>
            <dd className="font-mono text-code-md text-on-surface mt-1">
              {contexto?.loja?.telefone_whatsapp ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-label-sm text-on-surface-variant">Seu papel</dt>
            <dd className="mt-1">
              <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 bg-primary-fixed/30 text-label-sm text-primary uppercase">
                {contexto?.papel ? labelPapel(contexto.papel) : "—"}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {contexto?.organizacaoId ? (
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">sync</span>
            Integração legado
          </h2>
          {podeGerenciar ? (
            <ToggleSyncLegado ativoInicial={syncAtivo} />
          ) : (
            <p className="text-body-md text-on-surface-variant">
              Sync SS Plus:{" "}
              <strong className="text-on-surface">
                {syncAtivo ? "ligada" : "desligada"}
              </strong>
              . Apenas o dono pode alterar.
            </p>
          )}
        </section>
      ) : null}

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
        <h2 className="text-headline-sm text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">group</span>
          Usuários da loja
        </h2>
        {podeGerenciar ? (
          <>
            <ListaMembros membros={rows} />
            <FormConviteMembro />
          </>
        ) : (
          <table className="w-full text-left border-collapse text-body-md">
            <thead className="text-label-sm text-on-surface-variant">
              <tr>
                <th className="py-2 font-semibold">Usuário</th>
                <th className="py-2 w-32 font-semibold">Papel</th>
                <th className="py-2 w-40 font-semibold">Desde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.user_id} className="border-t border-outline-variant">
                  <td className="py-2">
                    {m.isSelf ? (
                      <span className="font-semibold text-on-surface">
                        {m.email} (você)
                      </span>
                    ) : (
                      <span className="font-mono text-code-md text-on-surface-variant">
                        {m.user_id.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="py-2 uppercase text-label-sm">{labelPapel(m.papel)}</td>
                  <td className="py-2 text-on-surface-variant">
                    {new Date(m.criado_em).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-headline-sm text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">info</span>
            Sobre
          </h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            Catálogo Industrial · ERP 2.0 · Espelho de estoque + balcão
          </p>
        </div>
        <form action={sair}>
          <button
            type="submit"
            className="flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-lg border border-error/40 text-error hover:bg-error hover:text-on-error transition-colors text-label-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sair
          </button>
        </form>
      </section>
    </div>
  );
}
