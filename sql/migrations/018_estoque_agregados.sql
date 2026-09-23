-- ERP 2.0 — Agregados de montagem vindos do SS Plus (GPASI /peca/dados.agregados)
-- Chave por código ERP (espelho), não por produtos.id — catálogo TecDoc usa outra numeração.

CREATE TABLE IF NOT EXISTS public.estoque_agregados (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    codigo_principal VARCHAR(40) NOT NULL,
    codigo_agregado VARCHAR(40) NOT NULL,
    quantidade_sugerida INT NOT NULL DEFAULT 1 CHECK (quantidade_sugerida > 0),
    ordem INT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    fonte TEXT NOT NULL DEFAULT 'erp'
        CHECK (fonte IN ('erp', 'manual', 'importacao')),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organizacao_id, codigo_principal, codigo_agregado),
    CHECK (codigo_principal <> codigo_agregado)
);

CREATE INDEX IF NOT EXISTS idx_estoque_agregados_principal
    ON public.estoque_agregados (organizacao_id, codigo_principal)
    WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_estoque_agregados_agregado
    ON public.estoque_agregados (organizacao_id, codigo_agregado)
    WHERE ativo = true;

COMMENT ON TABLE public.estoque_agregados IS
    'Agregados de montagem do SS Plus (campo agregados de /erpssplus/peca/dados).';

ALTER TABLE public.estoque_agregados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estoque_agregados_all ON public.estoque_agregados;
CREATE POLICY estoque_agregados_all ON public.estoque_agregados
    FOR ALL TO authenticated
    USING (
        organizacao_id IN (
            SELECT l.organizacao_id
            FROM public.membros_loja m
            JOIN public.lojas l ON l.id = m.loja_id
            WHERE m.user_id = auth.uid()
              AND l.organizacao_id IS NOT NULL
        )
    )
    WITH CHECK (
        organizacao_id IN (
            SELECT l.organizacao_id
            FROM public.membros_loja m
            JOIN public.lojas l ON l.id = m.loja_id
            WHERE m.user_id = auth.uid()
              AND l.organizacao_id IS NOT NULL
        )
    );

-- service_role bypassa RLS; sync Python usa service role.
