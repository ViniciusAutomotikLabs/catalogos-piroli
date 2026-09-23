-- TecDoc VPS — API PostgREST v2
-- PostgreSQL 16 / banco tecdoc_catalog
--
-- Pré-requisitos:
--   1. backup de schema e grants;
--   2. índices de sql/vps/tecdoc_api_v2_indexes.sql criados e válidos;
--   3. executar como administrador;
--   4. manter public.view_busca_catalogo sem alterações.
--
-- Cardinalidade:
--   view_tecdoc_artigos_v2        1 linha por articles.id
--   view_tecdoc_aplicacoes_v2     1 linha por (article_id, vehicle_id)
--   view_tecdoc_referencias_v2    1 linha por cross_references.id
--   view_tecdoc_imagens_v2        1 linha por JPEG de article_media
--   view_tecdoc_especificacoes_v2 1 linha por article_specifications.id

\set ON_ERROR_STOP on

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE VIEW public.view_tecdoc_artigos_v2 AS
SELECT
  a.id AS article_id,
  a.tecdoc_id,
  a.article_number,
  lower(regexp_replace(
    a.article_number::text,
    '[[:space:]./-]',
    '',
    'g'
  )) AS article_number_normalized,
  a.description,
  a.brand_id,
  b.tecdoc_id AS brand_tecdoc_id,
  b.name AS brand_name,
  b.logo_url AS brand_logo_url,
  a.category_id,
  c.tecdoc_id AS category_tecdoc_id,
  c.name AS category_name,
  c.level AS category_level,
  a.generic_article_id,
  a.ean_number,
  a.has_details,
  COALESCE(first_jpeg.s3_url, a.image_url) AS image_url
FROM public.articles AS a
LEFT JOIN public.brands AS b
  ON b.id = a.brand_id
LEFT JOIN public.categories AS c
  ON c.id = a.category_id
LEFT JOIN LATERAL (
  SELECT am.s3_url
  FROM public.article_media AS am
  WHERE am.article_id = a.id
    AND am.media_type = 'JPEG'
    AND am.s3_url IS NOT NULL
  ORDER BY am.id
  LIMIT 1
) AS first_jpeg ON true;

CREATE OR REPLACE VIEW public.view_tecdoc_aplicacoes_v2 AS
SELECT
  av.article_id,
  av.vehicle_id,
  v.ktype_id,
  v.model_id,
  m.tecdoc_id AS model_tecdoc_id,
  m.name AS model_name,
  m.display_name_br AS model_display_name_br,
  m.aliases AS model_aliases,
  m.parent_model_id,
  m.year_from AS model_year_from,
  m.year_to AS model_year_to,
  m.is_brazil_market AS model_is_brazil_market,
  m.variant_engine_codes,
  m.manufacturer_id,
  mf.tecdoc_id AS manufacturer_tecdoc_id,
  mf.name AS manufacturer_name,
  mf.logo_url AS manufacturer_logo_url,
  v.description AS vehicle_description,
  v.engine_code AS vehicle_engine_code,
  lower(regexp_replace(
    v.engine_code::text,
    '[[:space:]./-]',
    '',
    'g'
  )) AS vehicle_engine_code_normalized,
  v.power_hp AS vehicle_power_hp,
  v.power_kw AS vehicle_power_kw,
  v.fuel_type AS vehicle_fuel_type,
  v.year_from AS vehicle_year_from,
  v.year_to AS vehicle_year_to,
  v.drive_type,
  v.gear_type,
  v.body_type,
  v.num_doors,
  v.num_cylinders AS vehicle_num_cylinders,
  v.capacity_cc AS vehicle_capacity_cc,
  v.engine_tecdoc_id,
  v.is_brazil_market AS vehicle_is_brazil_market,
  e.id AS engine_id,
  e.code AS engine_code,
  e.manufacturer_name AS engine_manufacturer_name,
  e.num_cylinders AS engine_num_cylinders,
  e.capacity_cc AS engine_capacity_cc,
  e.power_kw AS engine_power_kw,
  e.power_hp AS engine_power_hp,
  e.power_rpm AS engine_power_rpm,
  e.max_torque AS engine_max_torque,
  e.torque_rpm AS engine_torque_rpm,
  e.bore AS engine_bore,
  e.stroke AS engine_stroke,
  e.compression AS engine_compression,
  e.fuel_type AS engine_fuel_type,
  e.charge_type AS engine_charge_type,
  e.construction AS engine_construction,
  e.cooling_type AS engine_cooling_type,
  e.emission_norm AS engine_emission_norm,
  e.usage_from AS engine_usage_from,
  e.usage_to AS engine_usage_to
FROM public.article_vehicles AS av
LEFT JOIN public.vehicles AS v
  ON v.id = av.vehicle_id
LEFT JOIN public.models AS m
  ON m.id = v.model_id
LEFT JOIN public.manufacturers AS mf
  ON mf.id = m.manufacturer_id
LEFT JOIN public.engines AS e
  ON e.tecdoc_id = v.engine_tecdoc_id;

CREATE OR REPLACE VIEW public.view_tecdoc_referencias_v2 AS
SELECT
  cr.id AS reference_id,
  cr.article_id,
  a.tecdoc_id AS article_tecdoc_id,
  a.article_number,
  cr.oem_number,
  lower(regexp_replace(
    cr.oem_number::text,
    '[[:space:]./-]',
    '',
    'g'
  )) AS oem_number_normalized,
  cr.oem_brand,
  NULLIF(
    lower(regexp_replace(
      cr.oem_brand::text,
      '[[:space:]./-]',
      '',
      'g'
    )),
    ''
  ) AS oem_brand_normalized,
  cr.manufacturer_id,
  mf.tecdoc_id AS manufacturer_tecdoc_id,
  mf.name AS manufacturer_name,
  mf.logo_url AS manufacturer_logo_url,
  a.brand_id AS article_brand_id,
  b.name AS article_brand_name
FROM public.cross_references AS cr
JOIN public.articles AS a
  ON a.id = cr.article_id
LEFT JOIN public.brands AS b
  ON b.id = a.brand_id
LEFT JOIN public.manufacturers AS mf
  ON mf.id = cr.manufacturer_id;

CREATE OR REPLACE VIEW public.view_tecdoc_imagens_v2 AS
SELECT
  am.id AS image_id,
  am.article_id,
  am.media_type,
  am.media_info,
  am.file_name,
  am.s3_url AS image_url,
  am.supplier_id
FROM public.article_media AS am
WHERE am.media_type = 'JPEG'
  AND am.s3_url IS NOT NULL;

CREATE OR REPLACE VIEW public.view_tecdoc_especificacoes_v2 AS
SELECT
  asp.id AS specification_id,
  asp.article_id,
  asp.criteria_name,
  lower(regexp_replace(
    asp.criteria_name::text,
    '[[:space:]./-]',
    '',
    'g'
  )) AS criteria_name_normalized,
  asp.criteria_value
FROM public.article_specifications AS asp;

COMMENT ON VIEW public.view_tecdoc_artigos_v2 IS
  'PostgREST v2: uma linha por artigo; primeira JPEG por article_media.id, com fallback para articles.image_url.';
COMMENT ON VIEW public.view_tecdoc_aplicacoes_v2 IS
  'PostgREST v2: uma linha por artigo e veículo; motor ligado por vehicles.engine_tecdoc_id = engines.tecdoc_id.';
COMMENT ON VIEW public.view_tecdoc_referencias_v2 IS
  'PostgREST v2: referências OEM/cruzadas, uma linha por cross_references.id.';
COMMENT ON VIEW public.view_tecdoc_imagens_v2 IS
  'PostgREST v2: uma linha por imagem JPEG válida.';
COMMENT ON VIEW public.view_tecdoc_especificacoes_v2 IS
  'PostgREST v2: uma linha por critério técnico de artigo.';

COMMENT ON COLUMN public.view_tecdoc_artigos_v2.article_number_normalized IS
  'Código em minúsculas sem espaços, ponto, barra ou hífen; compatível com o normalizador atual do aplicativo.';
COMMENT ON COLUMN public.view_tecdoc_referencias_v2.oem_number_normalized IS
  'OEM em minúsculas sem espaços, ponto, barra ou hífen; compatível com o normalizador atual do aplicativo.';

REVOKE ALL ON public.view_tecdoc_artigos_v2 FROM PUBLIC;
REVOKE ALL ON public.view_tecdoc_aplicacoes_v2 FROM PUBLIC;
REVOKE ALL ON public.view_tecdoc_referencias_v2 FROM PUBLIC;
REVOKE ALL ON public.view_tecdoc_imagens_v2 FROM PUBLIC;
REVOKE ALL ON public.view_tecdoc_especificacoes_v2 FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT SELECT ON
  public.view_tecdoc_artigos_v2,
  public.view_tecdoc_aplicacoes_v2,
  public.view_tecdoc_referencias_v2,
  public.view_tecdoc_imagens_v2,
  public.view_tecdoc_especificacoes_v2
TO web_anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
