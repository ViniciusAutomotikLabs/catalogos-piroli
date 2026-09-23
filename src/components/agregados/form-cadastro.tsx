"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  buscarProdutosParaAgregado,
  criarAgregado,
  removerAgregado,
} from "@/lib/actions/agregados";
import { codigoExibicao, tituloExibicao } from "@/lib/produto-campos";
import type { AgregadoItem } from "@/lib/agregados";
import { BotaoExcluirConfirmado } from "@/components/ui/botao-excluir-confirmado";

type ProdutoBusca = {
  id: number;
  codigo_principal: string | null;
  codigo_produto_interno: string;
  titulo_normalizado: string | null;
  descricao: string | null;
  foto_url: string | null;
  origem_catalogo: string;
};

type Props = {
  principal: ProdutoBusca;
  agregadosIniciais: AgregadoItem[];
};

export function FormCadastroAgregados({ principal, agregadosIniciais }: Props) {
  const router = useRouter();
  const [agregados, setAgregados] = useState(agregadosIniciais);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [obrigatorio, setObrigatorio] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, startBusca] = useTransition();
  const [salvando, startSalvar] = useTransition();

  const tituloPrincipal = tituloExibicao(principal);
  const codigoPrincipal = codigoExibicao(principal);

  useEffect(() => {
    setAgregados(agregadosIniciais);
  }, [agregadosIniciais]);

  function buscar() {
    setErro(null);
    startBusca(async () => {
      const rows = await buscarProdutosParaAgregado(termo);
      setResultados(
        rows.filter((r) => r.id !== principal.id) as ProdutoBusca[]
      );
    });
  }

  function adicionar(relacionadoId: number) {
    setErro(null);
    startSalvar(async () => {
      const res = await criarAgregado({
        produtoPrincipalId: principal.id,
        produtoRelacionadoId: relacionadoId,
        obrigatorio,
        quantidadeSugerida: quantidade,
      });
      if (!res.ok) {
        setErro(res.erro ?? "Falha ao salvar.");
        return;
      }
      setTermo("");
      setResultados([]);
      router.refresh();
    });
  }

  function remover(id: number) {
    setErro(null);
    startSalvar(async () => {
      const res = await removerAgregado(id, principal.id);
      if (!res.ok) {
        setErro(res.erro ?? "Falha ao remover.");
        return;
      }
      setAgregados((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        <p className="text-label-sm text-on-surface-variant uppercase">Peça principal</p>
        <h2 className="text-headline-sm text-on-surface font-semibold mt-1">{tituloPrincipal}</h2>
        <p className="font-mono text-code-md text-primary mt-1">{codigoPrincipal}</p>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm space-y-4">
        <h3 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">construction</span>
          Agregados cadastrados ({agregados.length})
        </h3>

        {agregados.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">
            Nenhum agregado ainda. Use a busca abaixo para adicionar itens da montagem.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {agregados.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="font-medium text-on-surface line-clamp-1">{a.titulo}</p>
                  <p className="font-mono text-code-md text-primary">{a.codigo}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {a.obrigatorio && (
                      <span className="text-label-sm text-primary">Obrigatório</span>
                    )}
                    {a.quantidadeSugerida > 1 && (
                      <span className="text-label-sm text-on-surface-variant">
                        Qtd. {a.quantidadeSugerida}
                      </span>
                    )}
                  </div>
                </div>
                <BotaoExcluirConfirmado
                  titulo="Remover agregado?"
                  descricao="Tem certeza que deseja apagar este item da montagem?"
                  ariaLabel="Remover agregado"
                  className="shrink-0 p-2 rounded-lg text-error hover:bg-error-container/30 transition-colors"
                  onConfirmar={async () => {
                    await remover(a.id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-primary/40 bg-primary-container/10 p-4 space-y-4">
        <h3 className="text-headline-sm font-semibold text-on-surface">Adicionar agregado</h3>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())}
            placeholder="Buscar peça agregada por código ou descrição..."
            className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <button
            type="button"
            onClick={buscar}
            disabled={buscando || termo.length < 2}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container disabled:opacity-50"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={obrigatorio}
              onChange={(e) => setObrigatorio(e.target.checked)}
              className="rounded border-outline-variant"
            />
            Obrigatório na montagem
          </label>
          <label className="flex items-center gap-2 text-body-md text-on-surface">
            Qtd.
            <input
              type="number"
              min={1}
              max={99}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-16 rounded border border-outline-variant px-2 py-1 text-center"
            />
          </label>
        </div>

        {erro && (
          <p className="text-body-md text-error bg-error-container/30 border border-error/30 rounded px-3 py-2">
            {erro}
          </p>
        )}

        {resultados.length > 0 && (
          <ul className="border border-outline-variant rounded-lg divide-y divide-outline-variant bg-surface-container-lowest max-h-64 overflow-y-auto">
            {resultados.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-on-surface line-clamp-1">{tituloExibicao(p)}</p>
                  <p className="font-mono text-code-md text-primary">{codigoExibicao(p)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => adicionar(p.id)}
                  disabled={salvando}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container disabled:opacity-50"
                >
                  Adicionar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
