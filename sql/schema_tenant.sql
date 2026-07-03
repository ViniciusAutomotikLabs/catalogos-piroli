-- Multi-tenant MVP 1.0 — 1 revenda = 1 loja; membros com papel dono/vendedor
-- + CRM (clientes), orçamentos (carrinho) e histórico de consultas.
-- Aplicado em 09/06/2026 via MCP. Referência: docs/ROADMAP_MVP.md § 9.2

-- Schema privado (não exposto via PostgREST) para helpers de RLS
CREATE SCHEMA IF NOT EXISTS private;

-- ===== Tabelas =====

CREATE TABLE IF NOT EXISTS public.lojas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18),
    telefone_whatsapp VARCHAR(20),
    logo_url TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.membros_loja (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    papel VARCHAR(20) NOT NULL DEFAULT 'vendedor' CHECK (papel IN ('dono','vendedor')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, loja_id)
);
CREATE INDEX IF NOT EXISTS idx_membros_loja_loja ON public.membros_loja (loja_id);

CREATE TABLE IF NOT EXISTS public.clientes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(18),
    contato_nome VARCHAR(255),
    telefone_whatsapp VARCHAR(20),
    email VARCHAR(255),
    especialidade VARCHAR(30) DEFAULT 'multimarcas' CHECK (especialidade IN ('multimarcas','especializada','linha_pesada')),
    marcas TEXT[] DEFAULT '{}',
    cep VARCHAR(9),
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf CHAR(2),
    ativo BOOLEAN NOT NULL DEFAULT true,
    ultima_compra_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clientes_loja ON public.clientes (loja_id);

CREATE TABLE IF NOT EXISTS public.orcamentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','cancelado')),
    validade_dias INTEGER NOT NULL DEFAULT 5,
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orcamentos_loja ON public.orcamentos (loja_id);

-- Preço unitário manual: estoque_loja/preço por loja só entram no MVP 2.0
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orcamento_id BIGINT NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
    produto_id INT REFERENCES public.produtos(id) ON DELETE SET NULL,
    descricao_avulsa VARCHAR(255),
    quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orc ON public.orcamento_itens (orcamento_id);

CREATE TABLE IF NOT EXISTS public.historico_consultas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    termo VARCHAR(255),
    produto_id INT REFERENCES public.produtos(id) ON DELETE SET NULL,
    contexto_veiculo VARCHAR(255),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historico_loja_data ON public.historico_consultas (loja_id, criado_em DESC);

-- ===== Helpers de RLS =====
-- SECURITY DEFINER em schema privado para evitar recursão de policy em membros_loja.
-- Sempre filtram por auth.uid() internamente.

CREATE OR REPLACE FUNCTION private.loja_ids_do_usuario()
RETURNS SETOF BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT loja_id FROM public.membros_loja WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.usuario_e_dono(p_loja_id BIGINT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.membros_loja
        WHERE user_id = auth.uid()
          AND papel = 'dono'
          AND (p_loja_id IS NULL OR loja_id = p_loja_id)
    )
$$;

REVOKE ALL ON FUNCTION private.loja_ids_do_usuario() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.usuario_e_dono(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.loja_ids_do_usuario() TO authenticated;
GRANT EXECUTE ON FUNCTION private.usuario_e_dono(BIGINT) TO authenticated;

-- ===== RLS =====

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_consultas ENABLE ROW LEVEL SECURITY;

-- lojas: membro lê; dono atualiza
CREATE POLICY lojas_select_membro ON public.lojas
    FOR SELECT TO authenticated
    USING (id IN (SELECT private.loja_ids_do_usuario()));
CREATE POLICY lojas_update_dono ON public.lojas
    FOR UPDATE TO authenticated
    USING (private.usuario_e_dono(id))
    WITH CHECK (private.usuario_e_dono(id));

-- membros_loja: membro vê colegas da mesma loja; dono gerencia
CREATE POLICY membros_select_mesma_loja ON public.membros_loja
    FOR SELECT TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));
CREATE POLICY membros_insert_dono ON public.membros_loja
    FOR INSERT TO authenticated
    WITH CHECK (private.usuario_e_dono(loja_id));
CREATE POLICY membros_delete_dono ON public.membros_loja
    FOR DELETE TO authenticated
    USING (private.usuario_e_dono(loja_id));

-- clientes / orcamentos / historico: CRUD isolado por loja_id
CREATE POLICY clientes_select ON public.clientes
    FOR SELECT TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));
CREATE POLICY clientes_insert ON public.clientes
    FOR INSERT TO authenticated
    WITH CHECK (loja_id IN (SELECT private.loja_ids_do_usuario()));
CREATE POLICY clientes_update ON public.clientes
    FOR UPDATE TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()))
    WITH CHECK (loja_id IN (SELECT private.loja_ids_do_usuario()));
CREATE POLICY clientes_delete ON public.clientes
    FOR DELETE TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));

CREATE POLICY orcamentos_select ON public.orcamentos
    FOR SELECT TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));
CREATE POLICY orcamentos_insert ON public.orcamentos
    FOR INSERT TO authenticated
    WITH CHECK (loja_id IN (SELECT private.loja_ids_do_usuario()));
CREATE POLICY orcamentos_update ON public.orcamentos
    FOR UPDATE TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()))
    WITH CHECK (loja_id IN (SELECT private.loja_ids_do_usuario()));
CREATE POLICY orcamentos_delete ON public.orcamentos
    FOR DELETE TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));

CREATE POLICY orcamento_itens_select ON public.orcamento_itens
    FOR SELECT TO authenticated
    USING (orcamento_id IN (SELECT id FROM public.orcamentos WHERE loja_id IN (SELECT private.loja_ids_do_usuario())));
CREATE POLICY orcamento_itens_insert ON public.orcamento_itens
    FOR INSERT TO authenticated
    WITH CHECK (orcamento_id IN (SELECT id FROM public.orcamentos WHERE loja_id IN (SELECT private.loja_ids_do_usuario())));
CREATE POLICY orcamento_itens_update ON public.orcamento_itens
    FOR UPDATE TO authenticated
    USING (orcamento_id IN (SELECT id FROM public.orcamentos WHERE loja_id IN (SELECT private.loja_ids_do_usuario())))
    WITH CHECK (orcamento_id IN (SELECT id FROM public.orcamentos WHERE loja_id IN (SELECT private.loja_ids_do_usuario())));
CREATE POLICY orcamento_itens_delete ON public.orcamento_itens
    FOR DELETE TO authenticated
    USING (orcamento_id IN (SELECT id FROM public.orcamentos WHERE loja_id IN (SELECT private.loja_ids_do_usuario())));

CREATE POLICY historico_select ON public.historico_consultas
    FOR SELECT TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));
CREATE POLICY historico_insert ON public.historico_consultas
    FOR INSERT TO authenticated
    WITH CHECK (loja_id IN (SELECT private.loja_ids_do_usuario()) AND user_id = (SELECT auth.uid()));
CREATE POLICY historico_delete ON public.historico_consultas
    FOR DELETE TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));

-- ===== Storage: bucket privado de imports + políticas =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('imports', 'imports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY imports_insert_dono ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'imports' AND private.usuario_e_dono());
CREATE POLICY imports_select_dono ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'imports' AND private.usuario_e_dono());

-- Dono pode registrar catálogo novo como pendente (pipeline atualiza via service_role)
CREATE POLICY catalogos_insert_dono ON public.catalogos
    FOR INSERT TO authenticated
    WITH CHECK (private.usuario_e_dono());

-- ===== Seed (executado manualmente) =====
-- 1 loja piloto + usuário dono criado via Auth Admin API:
--   INSERT INTO public.lojas (nome, telefone_whatsapp) VALUES ('AutoPeças Loja Piloto', '5511999990000');
--   INSERT INTO public.membros_loja (user_id, loja_id, papel) VALUES ('<uuid do auth.users>', 1, 'dono');
