import Link from "next/link";
import { requireModulo, getContextoLoja } from "@/lib/loja";
import { createErpClient } from "@/lib/supabase/erp";
import { BotaoConfirmarEntregaFila } from "@/components/vendas/botao-confirmar-entrega-fila";

export default async function EntregasPage() {
  await requireModulo("vendas");
  const contexto = await getContextoLoja();
  const sb = await createErpClient();

  const { data: vendas } = await sb
    .from("vendas")
    .select("id, status, entrega_status, total, criado_em")
    .eq("organizacao_id", contexto!.organizacaoId!)
    .eq("status", "fechada")
    .in("entrega_status", ["pendente", "parcial"])
    .order("criado_em", { ascending: true })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vendas" className="text-label-sm text-primary uppercase hover:underline">
          ← Vendas
        </Link>
        <h1 className="text-headline-lg text-on-surface font-bold tracking-tight mt-1">
          Entregas / Retiradas
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Fila de vendas fechadas aguardando baixa no espelho
        </p>
      </div>

      <ul className="space-y-3">
        {(vendas ?? []).length === 0 && (
          <li className="py-12 text-center text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
            Nenhuma entrega pendente.
          </li>
        )}
        {(vendas ?? []).map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-4"
          >
            <div>
              <Link href={`/vendas/${v.id}`} className="font-semibold text-primary hover:underline">
                Venda #{v.id}
              </Link>
              <p className="text-body-md text-on-surface-variant">
                {v.entrega_status} ·{" "}
                {new Date(v.criado_em).toLocaleString("pt-BR")}
              </p>
            </div>
            <BotaoConfirmarEntregaFila vendaId={v.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
