-- TecDoc VPS — índices da API PostgREST v2
--
-- IMPORTANTE:
-- - executar cada CREATE INDEX CONCURRENTLY separadamente;
-- - não envolver em BEGIN/COMMIT;
-- - criar um índice por vez e validar indisready/indisvalid;
-- - em caso de interrupção, remover o índice inválido antes de repetir;
-- - os índices de article_vehicles, FKs e detalhes por article_id já existem.

\set ON_ERROR_STOP on
\timing on

SET statement_timeout = '0';
SET lock_timeout = '5s';

-- Busca exata por código normalizado.
CREATE INDEX CONCURRENTLY articles_article_number_normalized_idx
ON public.articles (
  lower(regexp_replace(
    article_number::text,
    '[[:space:]./-]',
    '',
    'g'
  ))
);

-- Busca exata por OEM/referência normalizada.
CREATE INDEX CONCURRENTLY cross_references_oem_number_normalized_idx
ON public.cross_references (
  lower(regexp_replace(
    oem_number::text,
    '[[:space:]./-]',
    '',
    'g'
  ))
);

-- Primeira imagem JPEG por artigo sem ordenar toda a tabela de mídia.
CREATE INDEX CONCURRENTLY article_media_first_jpeg_v2_idx
ON public.article_media (article_id, id)
INCLUDE (s3_url)
WHERE media_type = 'JPEG'
  AND s3_url IS NOT NULL;

-- ADIADO EM 18/07/2026:
-- Os benchmarks externos da view legada ficaram entre 17 e 71 ms para
-- description=ilike.*Oil Filter* e model_name=ilike.*Gol*. Por isso, pg_trgm
-- e os índices GIN abaixo não foram criados. Só habilitar após evidência de
-- regressão em consultas textuais raras.
--
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
--
-- CREATE INDEX CONCURRENTLY articles_description_trgm_idx
-- ON public.articles
-- USING gin (description gin_trgm_ops);
--
-- CREATE INDEX CONCURRENTLY models_name_trgm_idx
-- ON public.models
-- USING gin (name gin_trgm_ops);
--
-- CREATE INDEX CONCURRENTLY vehicles_description_trgm_idx
-- ON public.vehicles
-- USING gin (description gin_trgm_ops);

RESET lock_timeout;
RESET statement_timeout;
