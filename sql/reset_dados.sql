-- Zera dados de catálogos para reprocessar do zero (MVP só PDF)
-- NÃO apaga estrutura das tabelas. Storage: esvaziar bucket no painel se quiser fotos novas.

TRUNCATE TABLE public.referencias_cruzadas RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.produtos RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.fabricantes RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.ingestao_jobs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.catalogos RESTART IDENTITY CASCADE;
