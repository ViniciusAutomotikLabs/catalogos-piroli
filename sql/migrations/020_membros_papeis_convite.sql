-- Fase 6: papéis de sistema extras + UPDATE de membros pelo dono
-- (inviteUserByEmail + membros_loja). CHECK legado só tinha dono/vendedor.

ALTER TABLE public.membros_loja
  DROP CONSTRAINT IF EXISTS membros_loja_papel_check;

ALTER TABLE public.membros_loja
  ADD CONSTRAINT membros_loja_papel_check
  CHECK (papel IN ('dono', 'vendedor', 'caixa', 'estoquista'));

DROP POLICY IF EXISTS membros_update_dono ON public.membros_loja;
CREATE POLICY membros_update_dono ON public.membros_loja
  FOR UPDATE TO authenticated
  USING (private.usuario_e_dono(loja_id))
  WITH CHECK (private.usuario_e_dono(loja_id));
