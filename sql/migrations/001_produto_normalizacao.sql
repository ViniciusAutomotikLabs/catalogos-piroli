-- BE-01 / BE-02: campos estruturados de normalização em produtos
-- Idempotente: ADD COLUMN IF NOT EXISTS

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.produtos
    ADD COLUMN IF NOT EXISTS descricao_original TEXT,
    ADD COLUMN IF NOT EXISTS titulo_normalizado TEXT,
    ADD COLUMN IF NOT EXISTS codigo_principal TEXT,
    ADD COLUMN IF NOT EXISTS codigos_extraidos TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS medidas_extraidas TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS aplicacao_resumo TEXT,
    ADD COLUMN IF NOT EXISTS normalizacao_status TEXT
        CHECK (normalizacao_status IS NULL OR normalizacao_status IN ('ok', 'parcial', 'revisar')),
    ADD COLUMN IF NOT EXISTS codigo_produto_interno_anterior TEXT,
    ADD COLUMN IF NOT EXISTS normalizado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.produtos.descricao_original IS 'Texto bruto do catálogo/PDF, preservado integralmente';
COMMENT ON COLUMN public.produtos.titulo_normalizado IS 'Nome curto limpo para exibição e busca';
COMMENT ON COLUMN public.produtos.codigo_principal IS 'Código mais confiável para venda/orçamento';
COMMENT ON COLUMN public.produtos.codigos_extraidos IS 'Códigos encontrados no texto (COD:, vazados etc.)';
COMMENT ON COLUMN public.produtos.medidas_extraidas IS 'Medidas extraídas (Ø, M16, dimensões)';
COMMENT ON COLUMN public.produtos.aplicacao_resumo IS 'Resumo de aplicação quando extraível do texto';
COMMENT ON COLUMN public.produtos.normalizacao_status IS 'ok | parcial | revisar';
COMMENT ON COLUMN public.produtos.codigo_produto_interno_anterior IS 'Valor anterior de codigo_produto_interno quando corrigido';

-- Índices para busca e backfill
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_principal
    ON public.produtos (codigo_principal);

CREATE INDEX IF NOT EXISTS idx_produtos_titulo_normalizado_trgm
    ON public.produtos USING gin (titulo_normalizado gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_produtos_normalizacao_status
    ON public.produtos (normalizacao_status)
    WHERE normalizacao_status IS NOT NULL;
