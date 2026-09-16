-- ERP 2.0 — Tokens de IA (DGX/Ollama como "nossa OpenAI", venda por consumo)
-- Base: docs/erp-2.0/MODELO_PESSOAS.md §4.
-- Medição desde o dia 1: toda chamada de IA gera débito; recargas geram crédito.
-- Ledger APPEND-ONLY (nunca UPDATE/DELETE); saldo = soma. Recarga/gateway em P2
-- (ganchos genéricos aqui; gateway concreto definido depois).

-- ===== Ledger append-only =====

CREATE TABLE IF NOT EXISTS public.token_ledger (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('credito','debito')),
    tokens BIGINT NOT NULL CHECK (tokens > 0),
    origem VARCHAR(20) NOT NULL CHECK (origem IN ('recarga','uso_ia','ajuste','bonus')),
    referencia_id BIGINT,           -- id da recarga ou do ia_uso que originou
    descricao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_token_ledger_loja ON public.token_ledger (loja_id, criado_em DESC);

-- ===== Recargas (ganchos genéricos de gateway; concreto em P2) =====

CREATE TABLE IF NOT EXISTS public.recargas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
    tokens BIGINT NOT NULL CHECK (tokens > 0),
    gateway VARCHAR(30),            -- 'mercadopago' | 'asaas' | 'stripe' | ... (P2)
    gateway_ref VARCHAR(120),       -- id da cobrança no gateway
    status VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','falhou')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    pago_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_recargas_loja ON public.recargas (loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_recargas_gateway_ref ON public.recargas (gateway, gateway_ref);

-- ===== Log de uso de IA (gera o débito) =====

CREATE TABLE IF NOT EXISTS public.ia_uso (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loja_id BIGINT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    modelo VARCHAR(80),
    prompt_tokens BIGINT NOT NULL DEFAULT 0,
    completion_tokens BIGINT NOT NULL DEFAULT 0,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_uso_loja ON public.ia_uso (loja_id, criado_em DESC);

-- ===== Saldo (derivado do ledger) =====

CREATE OR REPLACE VIEW public.token_saldo
WITH (security_invoker = true) AS
    SELECT
        loja_id,
        COALESCE(SUM(CASE WHEN tipo = 'credito' THEN tokens ELSE -tokens END), 0) AS saldo
    FROM public.token_ledger
    GROUP BY loja_id;

-- ===== Impede UPDATE/DELETE no ledger (append-only de verdade) =====

CREATE OR REPLACE FUNCTION private.bloqueia_mutacao_ledger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'token_ledger é append-only: % não permitido', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_token_ledger_no_update ON public.token_ledger;
CREATE TRIGGER trg_token_ledger_no_update
    BEFORE UPDATE OR DELETE ON public.token_ledger
    FOR EACH ROW EXECUTE FUNCTION private.bloqueia_mutacao_ledger();

-- ===== RLS =====

ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_uso ENABLE ROW LEVEL SECURITY;

-- Leitura: membro da loja vê o seu consumo/saldo.
-- Escrita: só service_role (débito de uso e crédito de recarga acontecem server-side,
-- via webhook/rota autenticada) — nenhuma policy de INSERT p/ authenticated.
CREATE POLICY token_ledger_select ON public.token_ledger
    FOR SELECT TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));

CREATE POLICY recargas_select ON public.recargas
    FOR SELECT TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));

CREATE POLICY ia_uso_select ON public.ia_uso
    FOR SELECT TO authenticated
    USING (loja_id IN (SELECT private.loja_ids_do_usuario()));

-- Dono pode iniciar uma recarga (status 'pendente'); a confirmação ('pago') e o
-- crédito no ledger são feitos server-side pelo webhook (service_role).
CREATE POLICY recargas_insert_dono ON public.recargas
    FOR INSERT TO authenticated
    WITH CHECK (
        private.usuario_e_dono(loja_id)
        AND status = 'pendente'
    );
