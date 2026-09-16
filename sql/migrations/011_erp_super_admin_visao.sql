-- ERP 2.0 — Visão do super admin (console SaaS)
-- O super admin opera FORA de um tenant: precisa enxergar todas as lojas,
-- organizações e membros para liberar/cortar módulos. Estas policies ADICIONAM
-- acesso de leitura para super admin (as policies de membro continuam valendo).
-- Escrita de entitlements já é coberta por `loja_modulos_write_super` (008).

-- Lojas: super admin lê todas.
DROP POLICY IF EXISTS lojas_select_super ON public.lojas;
CREATE POLICY lojas_select_super ON public.lojas
    FOR SELECT TO authenticated
    USING (private.usuario_e_super_admin());

-- Organizações: super admin lê todas.
DROP POLICY IF EXISTS organizacoes_select_super ON public.organizacoes;
CREATE POLICY organizacoes_select_super ON public.organizacoes
    FOR SELECT TO authenticated
    USING (private.usuario_e_super_admin());

-- Membros das lojas: super admin lê todos (para exibir e vincular usuários).
DROP POLICY IF EXISTS membros_loja_select_super ON public.membros_loja;
CREATE POLICY membros_loja_select_super ON public.membros_loja
    FOR SELECT TO authenticated
    USING (private.usuario_e_super_admin());

-- Saldo de tokens por loja: super admin enxerga todas (billing/consumo do SaaS).
-- A view token_saldo é security_invoker, então respeita as policies do ledger.
DROP POLICY IF EXISTS token_ledger_select_super ON public.token_ledger;
CREATE POLICY token_ledger_select_super ON public.token_ledger
    FOR SELECT TO authenticated
    USING (private.usuario_e_super_admin());
