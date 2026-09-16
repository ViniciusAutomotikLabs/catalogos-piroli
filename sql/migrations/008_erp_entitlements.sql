-- ERP 2.0 — Entitlements (módulos liberáveis por loja via super admin)
-- Base: docs/erp-2.0/MODELO_PESSOAS.md §3.
-- Cada loja contrata um subconjunto dos módulos; o super admin liga/desliga.
-- Fiscal e IA são módulos como os outros (add-on é só um registro em loja_modulos).

-- ===== Catálogo de módulos =====

CREATE TABLE IF NOT EXISTS public.modulos (
    chave VARCHAR(40) PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    descricao TEXT,
    ativo_global BOOLEAN NOT NULL DEFAULT true,  -- desliga o módulo p/ todos (kill switch)
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Entitlement por loja =====

CREATE TABLE IF NOT EXISTS public.loja_modulos (
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    modulo_chave VARCHAR(40) NOT NULL REFERENCES public.modulos(chave) ON DELETE CASCADE,
    ativo BOOLEAN NOT NULL DEFAULT true,
    valido_ate DATE,                              -- NULL = sem expiração
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (loja_id, modulo_chave)
);
CREATE INDEX IF NOT EXISTS idx_loja_modulos_loja ON public.loja_modulos (loja_id);

-- ===== Super admins (fora do tenant) =====

CREATE TABLE IF NOT EXISTS public.super_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Helpers =====

CREATE OR REPLACE FUNCTION private.usuario_e_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.loja_tem_modulo(p_loja_id BIGINT, p_modulo VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.loja_modulos lm
        JOIN public.modulos m ON m.chave = lm.modulo_chave
        WHERE lm.loja_id = p_loja_id
          AND lm.modulo_chave = p_modulo
          AND lm.ativo IS TRUE
          AND m.ativo_global IS TRUE
          AND (lm.valido_ate IS NULL OR lm.valido_ate >= CURRENT_DATE)
    )
$$;

REVOKE ALL ON FUNCTION private.usuario_e_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.loja_tem_modulo(BIGINT, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.usuario_e_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.loja_tem_modulo(BIGINT, VARCHAR) TO authenticated;

-- ===== RLS =====

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- modulos: qualquer autenticado lê o catálogo; só super admin escreve
CREATE POLICY modulos_select ON public.modulos
    FOR SELECT TO authenticated USING (true);
CREATE POLICY modulos_write_super ON public.modulos
    FOR ALL TO authenticated
    USING (private.usuario_e_super_admin())
    WITH CHECK (private.usuario_e_super_admin());

-- loja_modulos: membro da loja lê os seus; só super admin escreve (libera/corta)
CREATE POLICY loja_modulos_select ON public.loja_modulos
    FOR SELECT TO authenticated
    USING (
        loja_id IN (SELECT private.loja_ids_do_usuario())
        OR private.usuario_e_super_admin()
    );
CREATE POLICY loja_modulos_write_super ON public.loja_modulos
    FOR ALL TO authenticated
    USING (private.usuario_e_super_admin())
    WITH CHECK (private.usuario_e_super_admin());

-- super_admins: só o próprio super admin enxerga a lista
CREATE POLICY super_admins_select ON public.super_admins
    FOR SELECT TO authenticated
    USING (private.usuario_e_super_admin());

-- ===== Seed do catálogo de módulos =====

INSERT INTO public.modulos (chave, nome, descricao) VALUES
    ('pessoas',    'Cadastro de Pessoas', 'Clientes, fornecedores, vendedores, oficinas, mecânicos'),
    ('busca',      'Busca de Peças',      'Catálogo consolidado e referência cruzada'),
    ('orcamento',  'Orçamento',           'Carrinho e orçamento de balcão'),
    ('catalogos',  'Catálogos',           'Ingestão e administração de catálogos'),
    ('agregados',  'Agregados',           'Agregados de montagem'),
    ('historico',  'Histórico',           'Histórico de consultas'),
    ('financeiro', 'Financeiro',          'Títulos, boletos, fechamento (P1)'),
    ('fiscal',     'Fiscal',              'NF-e e integração fiscal (add-on, P2)'),
    ('ia',         'Inteligência Artificial', 'IA por consumo via DGX/Ollama (tokens)'),
    ('marketing',  'Marketing',           'Imagens e automação de marketing (P2)')
ON CONFLICT (chave) DO NOTHING;

-- Fiscal e marketing começam desligados globalmente até existirem de fato.
UPDATE public.modulos SET ativo_global = false WHERE chave IN ('fiscal','marketing');
