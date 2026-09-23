-- Upsert em lote do espelho (Redis/GPASI → estoque_saldos) via RPC service_role.
-- Necessário porque UNIQUE (org, unidade_id, codigo) não casa em unidade_id NULL.

CREATE OR REPLACE FUNCTION public.upsert_estoque_espelho(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r jsonb;
    n integer := 0;
BEGIN
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
        RETURN 0;
    END IF;

    FOR r IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
        INSERT INTO public.estoque_saldos AS e (
            organizacao_id,
            codigo,
            descricao,
            quantidade,
            reservado,
            preco,
            preco_atacado,
            atualizado_por_sync,
            atualizado_em
        )
        VALUES (
            (r->>'organizacao_id')::bigint,
            trim(r->>'codigo'),
            nullif(r->>'descricao', ''),
            coalesce((r->>'quantidade')::numeric, 0),
            coalesce((r->>'reservado')::numeric, 0),
            coalesce((r->>'preco')::numeric, 0),
            nullif(r->>'preco_atacado', '')::numeric,
            true,
            now()
        )
        ON CONFLICT (organizacao_id, codigo) WHERE unidade_id IS NULL
        DO UPDATE SET
            descricao = COALESCE(EXCLUDED.descricao, e.descricao),
            -- sync de preço sempre; quantidade só sobrescreve se veio >0 ou flag force
            quantidade = CASE
                WHEN EXCLUDED.quantidade > 0 THEN EXCLUDED.quantidade
                ELSE e.quantidade
            END,
            preco = EXCLUDED.preco,
            preco_atacado = COALESCE(EXCLUDED.preco_atacado, e.preco_atacado),
            atualizado_por_sync = true,
            atualizado_em = now();
        n := n + 1;
    END LOOP;

    RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_estoque_espelho(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_estoque_espelho(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_estoque_espelho(jsonb) TO postgres;
