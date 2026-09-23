-- Busca enxuta para o agente n8n (gpasi-search). Sem total_count, LIMIT cedo.
-- SECURITY DEFINER + GRANT só service_role.
-- Evita normalizar_codigo_busca() em 420k linhas (seq scan + timeout).

CREATE OR REPLACE FUNCTION public.buscar_produtos_agente(
    p_termo TEXT,
    p_catalogo TEXT DEFAULT NULL,
    p_limite INT DEFAULT 3
)
RETURNS TABLE (
    codigo TEXT,
    descricao TEXT,
    marca TEXT,
    aplicacao TEXT,
    catalogo TEXT,
    foto_url TEXT,
    referencias TEXT[],
    match_tipo TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '2500ms'
AS $$
DECLARE
    v_termo TEXT;
    v_limite INT;
    v_found INT;
    v_parece_codigo BOOLEAN;
BEGIN
    v_termo := nullif(trim(regexp_replace(coalesce(p_termo, ''), '[,()%]', ' ', 'g')), '');
    v_limite := greatest(1, least(coalesce(p_limite, 3), 5));

    IF v_termo IS NULL THEN
        RETURN;
    END IF;

    v_parece_codigo := v_termo !~ '\s' AND length(v_termo) >= 3;

    IF v_parece_codigo THEN
        -- 1) igualdade indexada em codigo_principal / codigo_produto_interno
        RETURN QUERY
        SELECT
            coalesce(p.codigo_principal, p.codigo_produto_interno)::TEXT,
            coalesce(p.titulo_normalizado, p.descricao)::TEXT,
            f.nome_fabricante::TEXT,
            left(coalesce(p.aplicacao_resumo, ''), 160)::TEXT,
            p.origem_catalogo::TEXT,
            p.foto_url::TEXT,
            ARRAY[]::TEXT[],
            'codigo_exato'::TEXT
        FROM public.produtos p
        LEFT JOIN public.fabricantes f ON f.id = p.fabricante_id
        WHERE (p_catalogo IS NULL OR p.origem_catalogo = p_catalogo)
          AND (
              p.codigo_principal = v_termo
              OR p.codigo_produto_interno = v_termo
          )
        ORDER BY p.id
        LIMIT v_limite;

        GET DIAGNOSTICS v_found = ROW_COUNT;
        IF v_found > 0 THEN
            RETURN;
        END IF;

        -- 2) prefixo no código (sem % no início — usa btree)
        RETURN QUERY
        SELECT
            coalesce(p.codigo_principal, p.codigo_produto_interno)::TEXT,
            coalesce(p.titulo_normalizado, p.descricao)::TEXT,
            f.nome_fabricante::TEXT,
            left(coalesce(p.aplicacao_resumo, ''), 160)::TEXT,
            p.origem_catalogo::TEXT,
            p.foto_url::TEXT,
            ARRAY[]::TEXT[],
            'codigo_parcial'::TEXT
        FROM public.produtos p
        LEFT JOIN public.fabricantes f ON f.id = p.fabricante_id
        WHERE (p_catalogo IS NULL OR p.origem_catalogo = p_catalogo)
          AND (
              p.codigo_principal LIKE v_termo || '%'
              OR p.codigo_produto_interno LIKE v_termo || '%'
          )
        ORDER BY p.id
        LIMIT v_limite;

        GET DIAGNOSTICS v_found = ROW_COUNT;
        IF v_found > 0 THEN
            RETURN;
        END IF;
    END IF;

    -- 3) todas as palavras no título (gin_trgm)
    RETURN QUERY
    SELECT
        coalesce(p.codigo_principal, p.codigo_produto_interno)::TEXT,
        coalesce(p.titulo_normalizado, p.descricao)::TEXT,
        f.nome_fabricante::TEXT,
        left(coalesce(p.aplicacao_resumo, ''), 160)::TEXT,
        p.origem_catalogo::TEXT,
        p.foto_url::TEXT,
        ARRAY[]::TEXT[],
        'texto'::TEXT
    FROM public.produtos p
    LEFT JOIN public.fabricantes f ON f.id = p.fabricante_id
    WHERE (p_catalogo IS NULL OR p.origem_catalogo = p_catalogo)
      AND p.titulo_normalizado IS NOT NULL
      AND p.titulo_normalizado ILIKE ALL (
          SELECT '%' || w || '%'
          FROM unnest(regexp_split_to_array(v_termo, '\s+')) AS w
          WHERE length(w) >= 3
      )
    ORDER BY p.id
    LIMIT v_limite;

    GET DIAGNOSTICS v_found = ROW_COUNT;
    IF v_found > 0 THEN
        RETURN;
    END IF;

    -- 4) fallback descrição (mais lento; LIMIT cedo)
    RETURN QUERY
    SELECT
        coalesce(p.codigo_principal, p.codigo_produto_interno)::TEXT,
        coalesce(p.titulo_normalizado, p.descricao)::TEXT,
        f.nome_fabricante::TEXT,
        left(coalesce(p.aplicacao_resumo, ''), 160)::TEXT,
        p.origem_catalogo::TEXT,
        p.foto_url::TEXT,
        ARRAY[]::TEXT[],
        'texto'::TEXT
    FROM public.produtos p
    LEFT JOIN public.fabricantes f ON f.id = p.fabricante_id
    WHERE (p_catalogo IS NULL OR p.origem_catalogo = p_catalogo)
      AND p.descricao ILIKE ALL (
          SELECT '%' || w || '%'
          FROM unnest(regexp_split_to_array(v_termo, '\s+')) AS w
          WHERE length(w) >= 3
      )
    ORDER BY p.id
    LIMIT v_limite;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_produtos_agente(TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buscar_produtos_agente(TEXT, TEXT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_produtos_agente(TEXT, TEXT, INT) TO service_role;
