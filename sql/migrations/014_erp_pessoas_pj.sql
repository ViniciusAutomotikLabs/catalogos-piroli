-- ERP 2.0 — Campos complementares de Pessoa Jurídica (plaintext; CNPJ segue cifrado)

ALTER TABLE public.pessoas
    ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(30),
    ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(30),
    ADD COLUMN IF NOT EXISTS codigo_interno VARCHAR(40),
    ADD COLUMN IF NOT EXISTS responsavel VARCHAR(120),
    ADD COLUMN IF NOT EXISTS observacoes TEXT;
