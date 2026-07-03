-- RLS — catálogo central legível apenas por usuários autenticados (app com login)
-- Escrita continua exclusiva do pipeline via service_role (bypass RLS).
-- Aplicado em 09/06/2026. Políticas multi-tenant em sql/schema_tenant.sql.

ALTER TABLE public.fabricantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referencias_cruzadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestao_jobs ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas (leitura pública anon do MVP inicial)
DROP POLICY IF EXISTS fabricantes_select_public ON public.fabricantes;
DROP POLICY IF EXISTS produtos_select_public ON public.produtos;
DROP POLICY IF EXISTS referencias_select_public ON public.referencias_cruzadas;
DROP POLICY IF EXISTS catalogos_select_public ON public.catalogos;
DROP POLICY IF EXISTS ingestao_jobs_select_public ON public.ingestao_jobs;

DROP POLICY IF EXISTS fabricantes_select_auth ON public.fabricantes;
DROP POLICY IF EXISTS produtos_select_auth ON public.produtos;
DROP POLICY IF EXISTS referencias_select_auth ON public.referencias_cruzadas;
DROP POLICY IF EXISTS catalogos_select_auth ON public.catalogos;

-- Leitura: somente authenticated (catálogo é compartilhado entre todas as lojas)
CREATE POLICY fabricantes_select_auth ON public.fabricantes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY produtos_select_auth ON public.produtos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY referencias_select_auth ON public.referencias_cruzadas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY catalogos_select_auth ON public.catalogos
    FOR SELECT TO authenticated USING (true);

-- ingestao_jobs: leitura apenas para donos de loja (depende de private.usuario_e_dono,
-- criada em sql/schema_tenant.sql)
DROP POLICY IF EXISTS ingestao_jobs_select_dono ON public.ingestao_jobs;
CREATE POLICY ingestao_jobs_select_dono ON public.ingestao_jobs
    FOR SELECT TO authenticated
    USING (private.usuario_e_dono());

-- INSERT/UPDATE/DELETE: não expostos — pipeline usa service_role (bypass RLS)
