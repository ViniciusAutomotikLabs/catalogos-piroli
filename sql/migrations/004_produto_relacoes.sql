-- BE-07 / PRD Agregados — relações globais entre produtos (demo + produção)

CREATE TABLE IF NOT EXISTS public.produto_relacoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    produto_principal_id INT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    produto_relacionado_id INT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL DEFAULT 'agregado'
        CHECK (tipo IN ('agregado', 'kit', 'equivalente', 'similar')),
    obrigatorio BOOLEAN NOT NULL DEFAULT false,
    quantidade_sugerida INT NOT NULL DEFAULT 1 CHECK (quantidade_sugerida > 0),
    ordem INT NOT NULL DEFAULT 0,
    observacao TEXT,
    fonte TEXT NOT NULL DEFAULT 'manual'
        CHECK (fonte IN ('manual', 'catalogo', 'erp', 'importacao')),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (produto_principal_id, produto_relacionado_id, tipo),
    CHECK (produto_principal_id <> produto_relacionado_id)
);

CREATE INDEX IF NOT EXISTS idx_produto_relacoes_principal
    ON public.produto_relacoes (produto_principal_id)
    WHERE ativo = true AND tipo IN ('agregado', 'kit');

ALTER TABLE public.produto_relacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS produto_relacoes_select_auth ON public.produto_relacoes;
DROP POLICY IF EXISTS produto_relacoes_insert_auth ON public.produto_relacoes;
DROP POLICY IF EXISTS produto_relacoes_update_auth ON public.produto_relacoes;
DROP POLICY IF EXISTS produto_relacoes_delete_auth ON public.produto_relacoes;

-- Demo MVP: qualquer usuário autenticado pode ler e cadastrar (regras globais).
CREATE POLICY produto_relacoes_select_auth ON public.produto_relacoes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY produto_relacoes_insert_auth ON public.produto_relacoes
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY produto_relacoes_update_auth ON public.produto_relacoes
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY produto_relacoes_delete_auth ON public.produto_relacoes
    FOR DELETE TO authenticated USING (true);
