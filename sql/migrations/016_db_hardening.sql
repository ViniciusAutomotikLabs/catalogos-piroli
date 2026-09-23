-- ERP 2.0 — Hardening pós-auditoria (advisors security + performance)
-- Projeto: oxqojsmlbptmofmhyfea (DatabaseCatalogo)
--
-- 1) RLS nas tabelas públicas sem proteção
-- 2) search_path fixo em 3 functions
-- 3) Índices em FKs sem cobertura (015 + legado quente)
-- 4) Unifica policies SELECT duplicadas (membro OR super)
-- 5) Seed estoque/vendas na loja piloto

-- ===== 1. RLS: produto_aplicacoes / foto_verificacao =====
-- Padrão catálogo: autenticado lê; escrita via service_role (bypassa RLS).

ALTER TABLE public.produto_aplicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foto_verificacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS produto_aplicacoes_select_auth ON public.produto_aplicacoes;
CREATE POLICY produto_aplicacoes_select_auth ON public.produto_aplicacoes
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS foto_verificacao_select_auth ON public.foto_verificacao;
CREATE POLICY foto_verificacao_select_auth ON public.foto_verificacao
    FOR SELECT TO authenticated
    USING (true);

-- ===== 2. Functions: search_path imutável =====

CREATE OR REPLACE FUNCTION public.normalizar_codigo_busca(p_codigo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
    SELECT lower(regexp_replace(coalesce(trim(p_codigo), ''), '[\s./\-]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION private.set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.atualizado_em := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.bloqueia_mutacao_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'token_ledger é append-only: % não permitido', TG_OP;
END;
$$;

-- ===== 3. Índices em FKs (schema-foreign-key-indexes) =====

-- Etapa 2 / espelho
CREATE INDEX IF NOT EXISTS idx_estoque_mov_criado_por
    ON public.estoque_movimentos (criado_por);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_produto
    ON public.estoque_movimentos (produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_unidade
    ON public.estoque_movimentos (unidade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_saldos_unidade
    ON public.estoque_saldos (unidade_id);

CREATE INDEX IF NOT EXISTS idx_vendas_loja ON public.vendas (loja_id);
CREATE INDEX IF NOT EXISTS idx_vendas_unidade ON public.vendas (unidade_id);
CREATE INDEX IF NOT EXISTS idx_vendas_orcamento ON public.vendas (orcamento_id);
CREATE INDEX IF NOT EXISTS idx_vendas_pessoa ON public.vendas (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON public.vendas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_oficina ON public.vendas (oficina_pessoa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_mecanico ON public.vendas (mecanico_pessoa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_criado_por ON public.vendas (criado_por);
CREATE INDEX IF NOT EXISTS idx_venda_itens_produto ON public.venda_itens (produto_id);

CREATE INDEX IF NOT EXISTS idx_fin_titulos_loja ON public.financeiro_titulos (loja_id);
CREATE INDEX IF NOT EXISTS idx_fin_titulos_criado_por ON public.financeiro_titulos (criado_por);

-- Legado quente (advisor)
CREATE INDEX IF NOT EXISTS idx_historico_produto
    ON public.historico_consultas (produto_id);
CREATE INDEX IF NOT EXISTS idx_historico_user
    ON public.historico_consultas (user_id);
CREATE INDEX IF NOT EXISTS idx_ia_uso_user ON public.ia_uso (user_id);
CREATE INDEX IF NOT EXISTS idx_loja_modulos_criado_por
    ON public.loja_modulos (criado_por);
CREATE INDEX IF NOT EXISTS idx_loja_modulos_modulo
    ON public.loja_modulos (modulo_chave);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_produto
    ON public.orcamento_itens (produto_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente
    ON public.orcamentos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_criado_por
    ON public.orcamentos (criado_por);
CREATE INDEX IF NOT EXISTS idx_pessoa_grupos_grupo
    ON public.pessoa_grupos_comerciais (grupo_comercial_id);
CREATE INDEX IF NOT EXISTS idx_pessoa_regras_unidade
    ON public.pessoa_regras_unidade (unidade_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_grupo_comercial
    ON public.pessoas (grupo_comercial_id);
CREATE INDEX IF NOT EXISTS idx_produto_relacoes_relacionado
    ON public.produto_relacoes (produto_relacionado_id);
CREATE INDEX IF NOT EXISTS idx_produtos_fabricante
    ON public.produtos (fabricante_id);

-- ===== 4. Policies SELECT: uma por tabela (evita multiple permissive) =====

-- loja_modulos: select já cobre super; write_super vira só escrita
DROP POLICY IF EXISTS loja_modulos_write_super ON public.loja_modulos;
CREATE POLICY loja_modulos_insert_super ON public.loja_modulos
    FOR INSERT TO authenticated
    WITH CHECK (private.usuario_e_super_admin());
CREATE POLICY loja_modulos_update_super ON public.loja_modulos
    FOR UPDATE TO authenticated
    USING (private.usuario_e_super_admin())
    WITH CHECK (private.usuario_e_super_admin());
CREATE POLICY loja_modulos_delete_super ON public.loja_modulos
    FOR DELETE TO authenticated
    USING (private.usuario_e_super_admin());

-- lojas: unifica SELECT
DROP POLICY IF EXISTS lojas_select_membro ON public.lojas;
DROP POLICY IF EXISTS lojas_select_super ON public.lojas;
CREATE POLICY lojas_select ON public.lojas
    FOR SELECT TO authenticated
    USING (
        id IN (SELECT private.loja_ids_do_usuario())
        OR private.usuario_e_super_admin()
    );

-- membros_loja: unifica SELECT
DROP POLICY IF EXISTS membros_select_mesma_loja ON public.membros_loja;
DROP POLICY IF EXISTS membros_loja_select_super ON public.membros_loja;
CREATE POLICY membros_loja_select ON public.membros_loja
    FOR SELECT TO authenticated
    USING (
        loja_id IN (SELECT private.loja_ids_do_usuario())
        OR private.usuario_e_super_admin()
    );

-- modulos: write_super só escrita (select já é true)
DROP POLICY IF EXISTS modulos_write_super ON public.modulos;
CREATE POLICY modulos_insert_super ON public.modulos
    FOR INSERT TO authenticated
    WITH CHECK (private.usuario_e_super_admin());
CREATE POLICY modulos_update_super ON public.modulos
    FOR UPDATE TO authenticated
    USING (private.usuario_e_super_admin())
    WITH CHECK (private.usuario_e_super_admin());
CREATE POLICY modulos_delete_super ON public.modulos
    FOR DELETE TO authenticated
    USING (private.usuario_e_super_admin());

-- organizacoes: unifica SELECT
DROP POLICY IF EXISTS organizacoes_select ON public.organizacoes;
DROP POLICY IF EXISTS organizacoes_select_super ON public.organizacoes;
CREATE POLICY organizacoes_select ON public.organizacoes
    FOR SELECT TO authenticated
    USING (
        id IN (SELECT private.organizacao_ids_do_usuario())
        OR private.usuario_e_super_admin()
    );

-- rh_tabelas_legais: write_super só escrita
DROP POLICY IF EXISTS rh_tabelas_legais_write_super ON public.rh_tabelas_legais;
CREATE POLICY rh_tabelas_legais_insert_super ON public.rh_tabelas_legais
    FOR INSERT TO authenticated
    WITH CHECK (private.usuario_e_super_admin());
CREATE POLICY rh_tabelas_legais_update_super ON public.rh_tabelas_legais
    FOR UPDATE TO authenticated
    USING (private.usuario_e_super_admin())
    WITH CHECK (private.usuario_e_super_admin());
CREATE POLICY rh_tabelas_legais_delete_super ON public.rh_tabelas_legais
    FOR DELETE TO authenticated
    USING (private.usuario_e_super_admin());

-- token_ledger: unifica SELECT
DROP POLICY IF EXISTS token_ledger_select ON public.token_ledger;
DROP POLICY IF EXISTS token_ledger_select_super ON public.token_ledger;
CREATE POLICY token_ledger_select ON public.token_ledger
    FOR SELECT TO authenticated
    USING (
        loja_id IN (SELECT private.loja_ids_do_usuario())
        OR private.usuario_e_super_admin()
    );

-- ===== 5. Entitlements loja piloto (estoque + vendas) =====

INSERT INTO public.loja_modulos (loja_id, modulo_chave, ativo)
VALUES
    (1, 'estoque', true),
    (1, 'vendas', true)
ON CONFLICT (loja_id, modulo_chave) DO UPDATE
SET ativo = true;
