-- BE-04 / BE-05: RPC de busca com ranking por tipo de match

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.normalizar_codigo_busca(p_codigo TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT lower(regexp_replace(coalesce(trim(p_codigo), ''), '[\s./\-]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.buscar_produtos(
    p_termo TEXT DEFAULT NULL,
    p_catalogo TEXT DEFAULT NULL,
    p_com_foto BOOLEAN DEFAULT FALSE,
    p_pagina INT DEFAULT 1,
    p_limite INT DEFAULT 25
)
RETURNS TABLE (
    id INT,
    codigo_principal TEXT,
    codigo_produto_interno TEXT,
    numero_produto TEXT,
    titulo_normalizado TEXT,
    descricao_original TEXT,
    descricao TEXT,
    origem_catalogo TEXT,
    foto_url TEXT,
    unidade TEXT,
    fabricante TEXT,
    referencias TEXT[],
    match_tipo TEXT,
    match_valor TEXT,
    score NUMERIC,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_termo TEXT;
    v_termo_codigo TEXT;
    v_offset INT;
    v_total BIGINT;
BEGIN
    v_termo := nullif(trim(regexp_replace(coalesce(p_termo, ''), '[,()%]', ' ', 'g')), '');
    v_termo_codigo := nullif(public.normalizar_codigo_busca(v_termo), '');
    v_offset := greatest(0, (greatest(1, p_pagina) - 1) * greatest(1, least(p_limite, 100)));

    IF v_termo IS NULL THEN
        SELECT count(*) INTO v_total
        FROM public.produtos p
        WHERE (p_catalogo IS NULL OR p.origem_catalogo = p_catalogo)
          AND (NOT p_com_foto OR p.foto_url IS NOT NULL);

        RETURN QUERY
        SELECT
            p.id,
            coalesce(p.codigo_principal, p.codigo_produto_interno),
            p.codigo_produto_interno,
            p.numero_produto,
            coalesce(p.titulo_normalizado, p.descricao),
            coalesce(p.descricao_original, p.descricao),
            p.descricao,
            p.origem_catalogo,
            p.foto_url,
            p.unidade,
            f.nome_fabricante,
            coalesce(
                (SELECT array_agg(DISTINCT rc.numero_referencia ORDER BY rc.numero_referencia)
                 FROM public.referencias_cruzadas rc WHERE rc.produto_id = p.id),
                ARRAY[]::TEXT[]
            ),
            'texto'::TEXT,
            NULL::TEXT,
            0::NUMERIC,
            v_total
        FROM public.produtos p
        LEFT JOIN public.fabricantes f ON f.id = p.fabricante_id
        WHERE (p_catalogo IS NULL OR p.origem_catalogo = p_catalogo)
          AND (NOT p_com_foto OR p.foto_url IS NOT NULL)
        ORDER BY p.id
        OFFSET v_offset
        LIMIT greatest(1, least(p_limite, 100));
        RETURN;
    END IF;

    RETURN QUERY
    WITH refs AS (
        SELECT rc.produto_id, rc.numero_referencia
        FROM public.referencias_cruzadas rc
        WHERE rc.numero_referencia ILIKE '%' || v_termo || '%'
           OR (v_termo_codigo IS NOT NULL AND public.normalizar_codigo_busca(rc.numero_referencia) LIKE '%' || v_termo_codigo || '%')
    ),
    candidatos AS (
        SELECT
            p.id,
            p.codigo_produto_interno,
            p.codigo_principal,
            p.numero_produto,
            p.titulo_normalizado,
            p.descricao_original,
            p.descricao,
            p.origem_catalogo,
            p.foto_url,
            p.unidade,
            f.nome_fabricante AS fabricante,
            greatest(
                -- 1. Código principal exato
                CASE WHEN lower(coalesce(p.codigo_principal, p.codigo_produto_interno)) = lower(v_termo) THEN 1000 ELSE 0 END,
                -- 2. Referência cruzada exata
                CASE WHEN EXISTS (
                    SELECT 1 FROM refs r
                    WHERE r.produto_id = p.id AND lower(r.numero_referencia) = lower(v_termo)
                ) THEN 900 ELSE 0 END,
                -- 3. Código principal normalizado
                CASE WHEN v_termo_codigo IS NOT NULL AND (
                    public.normalizar_codigo_busca(coalesce(p.codigo_principal, p.codigo_produto_interno)) = v_termo_codigo
                    OR public.normalizar_codigo_busca(p.numero_produto) = v_termo_codigo
                ) THEN 800 ELSE 0 END,
                -- 4. Referência normalizada
                CASE WHEN v_termo_codigo IS NOT NULL AND EXISTS (
                    SELECT 1 FROM refs r
                    WHERE r.produto_id = p.id
                      AND public.normalizar_codigo_busca(r.numero_referencia) LIKE '%' || v_termo_codigo || '%'
                      AND lower(r.numero_referencia) <> lower(v_termo)
                ) THEN 700 ELSE 0 END,
                -- 5. Título normalizado
                CASE WHEN coalesce(p.titulo_normalizado, p.descricao, '') ILIKE '%' || v_termo || '%' THEN 500 ELSE 0 END,
                -- 6. Texto livre (descrição original ou descricao)
                CASE WHEN coalesce(p.descricao_original, p.descricao, '') ILIKE '%' || v_termo || '%' THEN 300 ELSE 0 END,
                -- Fallback: match parcial em código interno
                CASE WHEN p.codigo_produto_interno ILIKE '%' || v_termo || '%' THEN 200 ELSE 0 END,
                CASE WHEN p.numero_produto ILIKE '%' || v_termo || '%' THEN 200 ELSE 0 END
            ) AS score,
            CASE
                WHEN lower(coalesce(p.codigo_principal, p.codigo_produto_interno)) = lower(v_termo) THEN 'codigo_exato'
                WHEN EXISTS (
                    SELECT 1 FROM refs r
                    WHERE r.produto_id = p.id AND lower(r.numero_referencia) = lower(v_termo)
                ) THEN 'referencia_exata'
                WHEN v_termo_codigo IS NOT NULL AND (
                    public.normalizar_codigo_busca(coalesce(p.codigo_principal, p.codigo_produto_interno)) = v_termo_codigo
                    OR public.normalizar_codigo_busca(p.numero_produto) = v_termo_codigo
                ) THEN 'codigo_normalizado'
                WHEN v_termo_codigo IS NOT NULL AND EXISTS (
                    SELECT 1 FROM refs r
                    WHERE r.produto_id = p.id
                      AND public.normalizar_codigo_busca(r.numero_referencia) LIKE '%' || v_termo_codigo || '%'
                ) THEN 'referencia_normalizada'
                WHEN coalesce(p.titulo_normalizado, p.descricao, '') ILIKE '%' || v_termo || '%' THEN 'texto'
                ELSE 'texto'
            END AS match_tipo,
            CASE
                WHEN lower(coalesce(p.codigo_principal, p.codigo_produto_interno)) = lower(v_termo)
                    THEN coalesce(p.codigo_principal, p.codigo_produto_interno)
                WHEN EXISTS (
                    SELECT 1 FROM refs r
                    WHERE r.produto_id = p.id AND lower(r.numero_referencia) = lower(v_termo)
                ) THEN (
                    SELECT r.numero_referencia FROM refs r
                    WHERE r.produto_id = p.id AND lower(r.numero_referencia) = lower(v_termo)
                    LIMIT 1
                )
                WHEN v_termo_codigo IS NOT NULL
                    AND public.normalizar_codigo_busca(coalesce(p.codigo_principal, p.codigo_produto_interno)) = v_termo_codigo
                    THEN coalesce(p.codigo_principal, p.codigo_produto_interno)
                WHEN v_termo_codigo IS NOT NULL
                    AND public.normalizar_codigo_busca(p.numero_produto) = v_termo_codigo
                    THEN p.numero_produto
                ELSE v_termo
            END AS match_valor
        FROM public.produtos p
        LEFT JOIN public.fabricantes f ON f.id = p.fabricante_id
        WHERE (p_catalogo IS NULL OR p.origem_catalogo = p_catalogo)
          AND (NOT p_com_foto OR p.foto_url IS NOT NULL)
          AND (
              coalesce(p.codigo_principal, p.codigo_produto_interno) ILIKE '%' || v_termo || '%'
              OR p.numero_produto ILIKE '%' || v_termo || '%'
              OR coalesce(p.titulo_normalizado, p.descricao, '') ILIKE '%' || v_termo || '%'
              OR coalesce(p.descricao_original, p.descricao, '') ILIKE '%' || v_termo || '%'
              OR (v_termo_codigo IS NOT NULL AND (
                  public.normalizar_codigo_busca(coalesce(p.codigo_principal, p.codigo_produto_interno)) LIKE '%' || v_termo_codigo || '%'
                  OR public.normalizar_codigo_busca(p.numero_produto) LIKE '%' || v_termo_codigo || '%'
              ))
              OR EXISTS (SELECT 1 FROM refs r WHERE r.produto_id = p.id)
          )
    ),
    filtrados AS (
        SELECT * FROM candidatos WHERE score > 0
    ),
    total AS (
        SELECT count(*)::BIGINT AS cnt FROM filtrados
    )
    SELECT
        c.id,
        coalesce(c.codigo_principal, c.codigo_produto_interno),
        c.codigo_produto_interno,
        c.numero_produto,
        coalesce(c.titulo_normalizado, c.descricao),
        coalesce(c.descricao_original, c.descricao),
        c.descricao,
        c.origem_catalogo,
        c.foto_url,
        c.unidade,
        c.fabricante,
        coalesce(
            (SELECT array_agg(DISTINCT rc.numero_referencia ORDER BY rc.numero_referencia)
             FROM public.referencias_cruzadas rc WHERE rc.produto_id = c.id),
            ARRAY[]::TEXT[]
        ),
        c.match_tipo,
        c.match_valor,
        c.score::NUMERIC,
        (SELECT cnt FROM total)
    FROM filtrados c
    ORDER BY c.score DESC, c.id
    OFFSET v_offset
    LIMIT greatest(1, least(p_limite, 100));
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_produtos(TEXT, TEXT, BOOLEAN, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_produtos(TEXT, TEXT, BOOLEAN, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_produtos(TEXT, TEXT, BOOLEAN, INT, INT) TO anon;
