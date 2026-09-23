-- Código fabricante + marca no espelho (para busca de catálogo e ficha estilo SS)
ALTER TABLE public.estoque_saldos
  ADD COLUMN IF NOT EXISTS codigo_fabricante VARCHAR(60),
  ADD COLUMN IF NOT EXISTS marca VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_estoque_saldos_org_fab
  ON public.estoque_saldos (organizacao_id, codigo_fabricante)
  WHERE codigo_fabricante IS NOT NULL;

COMMENT ON COLUMN public.estoque_saldos.codigo_fabricante IS
  'Código do fabricante (SS/GPASI codigofabricante) — usar na busca de catálogos';
COMMENT ON COLUMN public.estoque_saldos.marca IS
  'Descrição marca SS/GPASI (campo marca)';
