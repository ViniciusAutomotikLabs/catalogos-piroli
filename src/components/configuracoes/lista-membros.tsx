"use client";

import { useTransition } from "react";
import { alterarPapelMembro, revogarMembro } from "@/lib/actions/membros";
import { PAPEIS_MEMBRO, labelPapel } from "@/lib/membros";

type MembroRow = {
  user_id: string;
  papel: string;
  criado_em: string;
  email: string | null;
  isSelf: boolean;
};

export function ListaMembros({ membros }: { membros: MembroRow[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-left border-collapse text-body-md min-w-[520px]">
        <thead className="text-label-sm text-on-surface-variant">
          <tr>
            <th className="py-2 font-semibold">Usuário</th>
            <th className="py-2 w-40 font-semibold">Papel</th>
            <th className="py-2 w-28 font-semibold">Desde</th>
            <th className="py-2 w-28 font-semibold text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {membros.map((m) => (
            <tr key={m.user_id} className="border-t border-outline-variant">
              <td className="py-3">
                {m.isSelf ? (
                  <span className="font-semibold text-on-surface">
                    {m.email ?? "Você"}{" "}
                    <span className="text-on-surface-variant font-normal">(você)</span>
                  </span>
                ) : (
                  <span className="text-on-surface">
                    {m.email ?? (
                      <span className="font-mono text-code-md text-on-surface-variant">
                        {m.user_id.slice(0, 8)}…
                      </span>
                    )}
                  </span>
                )}
              </td>
              <td className="py-3">
                {m.isSelf ? (
                  <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 bg-primary-fixed/30 text-label-sm text-primary uppercase">
                    {labelPapel(m.papel)}
                  </span>
                ) : (
                  <select
                    defaultValue={m.papel}
                    disabled={pending}
                    aria-label={`Papel de ${m.email ?? m.user_id}`}
                    className="min-h-11 w-full max-w-[9rem] rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-label-sm uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    onChange={(e) => {
                      const papel = e.target.value;
                      start(async () => {
                        const res = await alterarPapelMembro(m.user_id, papel);
                        if (res?.erro) alert(res.erro);
                      });
                    }}
                  >
                    {PAPEIS_MEMBRO.map((p) => (
                      <option key={p} value={p}>
                        {labelPapel(p)}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td className="py-3 text-on-surface-variant">
                {new Date(m.criado_em).toLocaleDateString("pt-BR")}
              </td>
              <td className="py-3 text-right">
                {m.isSelf ? (
                  <span className="text-on-surface-variant text-label-sm">—</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-error/40 px-3 text-label-sm uppercase text-error transition-colors hover:bg-error hover:text-on-error disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                    onClick={() => {
                      if (!confirm("Remover o acesso deste usuário à loja?")) return;
                      start(async () => {
                        const res = await revogarMembro(m.user_id);
                        if (res?.erro) alert(res.erro);
                      });
                    }}
                  >
                    Revogar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
