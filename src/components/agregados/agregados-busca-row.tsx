import Link from "next/link";
import type { AgregadoItem } from "@/lib/agregados";
import { AdicionarAgregadosButton } from "./adicionar-agregados-button";

const MAX_CHIPS = 3;

type Props = {
  agregados: AgregadoItem[];
  principal: {
    produtoId: number | null;
    codigo: string;
    descricao: string;
    fabricante?: string | null;
    fotoUrl?: string | null;
  };
};

export function AgregadosBuscaRow({ agregados, principal }: Props) {
  if (agregados.length === 0) return null;

  const visiveis = agregados.slice(0, MAX_CHIPS);
  const restantes = agregados.length - visiveis.length;
  const detalheHref = principal.produtoId
    ? `/produtos/${principal.produtoId}`
    : `/busca?q=${encodeURIComponent(principal.codigo)}`;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">construction</span>
        Montagem:
      </span>
      {visiveis.map((a) => (
        <span
          key={`${a.codigo}-${a.id}`}
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-4 ${
            a.obrigatorio
              ? "border-primary/40 bg-primary-container/30 text-on-primary-container font-medium"
              : "border-outline-variant bg-surface text-on-surface-variant"
          }`}
          title={a.obrigatorio ? "Obrigatório na montagem" : "Recomendado"}
        >
          {a.titulo}
          {a.quantidadeSugerida > 1 ? ` ×${a.quantidadeSugerida}` : ""}
        </span>
      ))}
      {restantes > 0 && (
        <Link href={detalheHref} className="text-label-sm text-primary hover:underline">
          +{restantes}
        </Link>
      )}
      <AdicionarAgregadosButton principal={principal} agregados={agregados} />
    </div>
  );
}
