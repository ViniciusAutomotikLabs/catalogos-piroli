-- ERP 2.0 — Grupos comerciais N:N por pessoa (+ custom livre, padrão papéis)
-- Substitui o uso de pessoas.grupo_comercial_id (coluna permanece nullable p/ compat).

CREATE TABLE IF NOT EXISTS public.pessoa_grupos_comerciais (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    grupo_comercial_id BIGINT REFERENCES public.grupos_comerciais(id) ON DELETE CASCADE,
    grupo_custom VARCHAR(120),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (grupo_comercial_id IS NOT NULL AND grupo_custom IS NULL)
        OR (grupo_comercial_id IS NULL AND grupo_custom IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pessoa_grupo_catalogo
    ON public.pessoa_grupos_comerciais (pessoa_id, grupo_comercial_id)
    WHERE grupo_comercial_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pessoa_grupo_custom
    ON public.pessoa_grupos_comerciais (pessoa_id, lower(grupo_custom))
    WHERE grupo_custom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pessoa_grupos_pessoa
    ON public.pessoa_grupos_comerciais (pessoa_id);

-- Backfill a partir da FK legada
INSERT INTO public.pessoa_grupos_comerciais (pessoa_id, grupo_comercial_id)
SELECT p.id, p.grupo_comercial_id
FROM public.pessoas p
WHERE p.grupo_comercial_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.pessoa_grupos_comerciais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pessoa_grupos_comerciais_all ON public.pessoa_grupos_comerciais;
CREATE POLICY pessoa_grupos_comerciais_all ON public.pessoa_grupos_comerciais
    FOR ALL TO authenticated
    USING (pessoa_id IN (
        SELECT id FROM public.pessoas
        WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
    ))
    WITH CHECK (pessoa_id IN (
        SELECT id FROM public.pessoas
        WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
    ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoa_grupos_comerciais TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE pessoa_grupos_comerciais_id_seq TO authenticated;
