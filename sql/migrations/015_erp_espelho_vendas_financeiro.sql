-- ERP 2.0 Etapa 2 — Espelho de estoque + vendas + financeiro mínimo + sync desligável
-- Espelho operacional (não WMS): saldo + movimentos + preço.
-- Sync GPASI/SS Plus respeita organizacoes.sync_legado_ativo.

-- ===== Flag de sync legado (SS Plus / GPASI) =====

ALTER TABLE public.organizacoes
    ADD COLUMN IF NOT EXISTS sync_legado_ativo BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organizacoes.sync_legado_ativo IS
    'Se true, jobs GPASI atualizam o espelho. Se false, jobs são no-op e o ERP opera só com saldos/movimentos locais.';

-- ===== Módulos novos =====

INSERT INTO public.modulos (chave, nome, descricao) VALUES
    ('estoque', 'Estoque', 'Espelho de saldo e movimentos por unidade'),
    ('vendas',  'Vendas',  'Orçamento → venda → entrega no balcão'),
    ('rh',      'RH',      'Contratos, folha, férias e documentos de colaboradores')
ON CONFLICT (chave) DO NOTHING;

-- ===== Espelho: saldos =====

CREATE TABLE IF NOT EXISTS public.estoque_saldos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    unidade_id BIGINT REFERENCES public.unidades(id) ON DELETE SET NULL,
    codigo VARCHAR(40) NOT NULL,
    produto_id INT REFERENCES public.produtos(id) ON DELETE SET NULL,
    descricao VARCHAR(255),
    quantidade NUMERIC(14,3) NOT NULL DEFAULT 0,
    reservado NUMERIC(14,3) NOT NULL DEFAULT 0,
    preco NUMERIC(12,2) NOT NULL DEFAULT 0,
    preco_atacado NUMERIC(12,2),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_por_sync BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (organizacao_id, unidade_id, codigo)
);
-- Postgres trata NULL distinto em UNIQUE; garante 1 saldo "sem unidade" por código.
CREATE UNIQUE INDEX IF NOT EXISTS uq_estoque_saldos_org_codigo_sem_unidade
    ON public.estoque_saldos (organizacao_id, codigo)
    WHERE unidade_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_estoque_saldos_org_codigo
    ON public.estoque_saldos (organizacao_id, codigo);
CREATE INDEX IF NOT EXISTS idx_estoque_saldos_produto
    ON public.estoque_saldos (produto_id)
    WHERE produto_id IS NOT NULL;

-- ===== Espelho: movimentos =====

CREATE TABLE IF NOT EXISTS public.estoque_movimentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    unidade_id BIGINT REFERENCES public.unidades(id) ON DELETE SET NULL,
    codigo VARCHAR(40) NOT NULL,
    produto_id INT REFERENCES public.produtos(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN (
        'sync','entrada','saida','reserva','entrega','ajuste','cancelamento'
    )),
    quantidade NUMERIC(14,3) NOT NULL,
    saldo_apos NUMERIC(14,3),
    referencia_tipo VARCHAR(30),
    referencia_id BIGINT,
    observacao TEXT,
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_org_data
    ON public.estoque_movimentos (organizacao_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_ref
    ON public.estoque_movimentos (referencia_tipo, referencia_id);

-- ===== Vendas =====

CREATE TABLE IF NOT EXISTS public.vendas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    unidade_id BIGINT REFERENCES public.unidades(id) ON DELETE SET NULL,
    orcamento_id BIGINT REFERENCES public.orcamentos(id) ON DELETE SET NULL,
    pessoa_id BIGINT REFERENCES public.pessoas(id) ON DELETE SET NULL,
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'rascunho'
        CHECK (status IN ('rascunho','aberta','fechada','cancelada')),
    entrega_status VARCHAR(20) NOT NULL DEFAULT 'pendente'
        CHECK (entrega_status IN ('pendente','parcial','entregue','retirada')),
    oficina_pessoa_id BIGINT REFERENCES public.pessoas(id) ON DELETE SET NULL,
    mecanico_pessoa_id BIGINT REFERENCES public.pessoas(id) ON DELETE SET NULL,
    comissao_oficina_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    comissao_mecanico_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    observacao TEXT,
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechada_em TIMESTAMPTZ,
    entregue_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vendas_org_status
    ON public.vendas (organizacao_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_entrega
    ON public.vendas (organizacao_id, entrega_status)
    WHERE status = 'fechada' AND entrega_status IN ('pendente','parcial');

CREATE TABLE IF NOT EXISTS public.venda_itens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venda_id BIGINT NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    produto_id INT REFERENCES public.produtos(id) ON DELETE SET NULL,
    codigo VARCHAR(40),
    descricao VARCHAR(255) NOT NULL,
    quantidade NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    quantidade_entregue NUMERIC(14,3) NOT NULL DEFAULT 0,
    preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON public.venda_itens (venda_id);

-- ===== Financeiro mínimo (2.1) =====

CREATE TABLE IF NOT EXISTS public.financeiro_titulos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    venda_id BIGINT REFERENCES public.vendas(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'receber'
        CHECK (tipo IN ('receber','pagar')),
    descricao VARCHAR(255) NOT NULL,
    valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'aberto'
        CHECK (status IN ('aberto','pago','cancelado')),
    vencimento DATE,
    pago_em TIMESTAMPTZ,
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_titulos_org_status
    ON public.financeiro_titulos (organizacao_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_fin_titulos_venda
    ON public.financeiro_titulos (venda_id);

-- ===== RLS =====

ALTER TABLE public.estoque_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_titulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estoque_saldos_all ON public.estoque_saldos;
CREATE POLICY estoque_saldos_all ON public.estoque_saldos
    FOR ALL TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()))
    WITH CHECK (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

DROP POLICY IF EXISTS estoque_movimentos_all ON public.estoque_movimentos;
CREATE POLICY estoque_movimentos_all ON public.estoque_movimentos
    FOR ALL TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()))
    WITH CHECK (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

DROP POLICY IF EXISTS vendas_all ON public.vendas;
CREATE POLICY vendas_all ON public.vendas
    FOR ALL TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()))
    WITH CHECK (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

DROP POLICY IF EXISTS venda_itens_all ON public.venda_itens;
CREATE POLICY venda_itens_all ON public.venda_itens
    FOR ALL TO authenticated
    USING (venda_id IN (
        SELECT id FROM public.vendas
        WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
    ))
    WITH CHECK (venda_id IN (
        SELECT id FROM public.vendas
        WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
    ));

DROP POLICY IF EXISTS financeiro_titulos_all ON public.financeiro_titulos;
CREATE POLICY financeiro_titulos_all ON public.financeiro_titulos
    FOR ALL TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()))
    WITH CHECK (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

-- organizacoes: membros da org podem atualizar sync_legado_ativo (app restringe a dono)
DROP POLICY IF EXISTS organizacoes_update_membro ON public.organizacoes;
CREATE POLICY organizacoes_update_membro ON public.organizacoes
    FOR UPDATE TO authenticated
    USING (id IN (SELECT private.organizacao_ids_do_usuario()))
    WITH CHECK (id IN (SELECT private.organizacao_ids_do_usuario()));
