-- ERP 2.0 — Módulo Pessoas (multi-tenant por organização)
-- Base: docs/erp-2.0/MODELO_PESSOAS.md. Segue o padrão de RLS de sql/schema_tenant.sql.
--
-- Criptografia: colunas *_cifrado (bytea) e *_bidx (blind index/HMAC, bytea) são
-- preenchidas NA APLICAÇÃO (chave em secret do Coolify, nunca no banco). O Postgres
-- só guarda bytes opacos — um dump vazado é inútil sem a chave. *_mascara guarda
-- apenas os dígitos finais para exibição.
--
-- Papel comercial (pessoa_papeis) é SEPARADO de permissão de sistema (membros_loja).

-- ===== Organização e unidades =====

CREATE TABLE IF NOT EXISTS public.organizacoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    documento_mascara VARCHAR(20),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma loja existente pertence a uma organização (1 org : N lojas no v1).
ALTER TABLE public.lojas
    ADD COLUMN IF NOT EXISTS organizacao_id BIGINT REFERENCES public.organizacoes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lojas_organizacao ON public.lojas (organizacao_id);

-- Unidades = "empresas 0001/0003/0004" do SS Plus.
CREATE TABLE IF NOT EXISTS public.unidades (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    codigo VARCHAR(10),
    nome VARCHAR(255) NOT NULL,
    cidade VARCHAR(100),
    uf CHAR(2),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organizacao_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_unidades_org ON public.unidades (organizacao_id);

-- ===== Grupos comerciais (configuráveis pela organização) =====

CREATE TABLE IF NOT EXISTS public.grupos_comerciais (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    chave VARCHAR(40) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organizacao_id, chave)
);
CREATE INDEX IF NOT EXISTS idx_grupos_org ON public.grupos_comerciais (organizacao_id);

-- ===== Pessoa (identidade central PF/PJ) =====

CREATE TABLE IF NOT EXISTS public.pessoas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    tipo_pessoa VARCHAR(2) NOT NULL DEFAULT 'PF' CHECK (tipo_pessoa IN ('PF','PJ')),
    nome VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    documento_cifrado BYTEA,        -- CPF/CNPJ cifrado na aplicação
    documento_bidx BYTEA,           -- blind index (HMAC) p/ busca por igualdade
    documento_mascara VARCHAR(20),  -- exibição (ex.: ***.***.678-90)
    foto_url TEXT,                  -- bucket privado 'pessoas'
    grupo_comercial_id BIGINT REFERENCES public.grupos_comerciais(id) ON DELETE SET NULL,
    situacao VARCHAR(10) NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pessoas_org ON public.pessoas (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_documento_bidx ON public.pessoas (documento_bidx);
CREATE INDEX IF NOT EXISTS idx_pessoas_nome ON public.pessoas (organizacao_id, nome);

-- ===== Papéis comerciais (N por pessoa; != permissão de sistema) =====

CREATE TABLE IF NOT EXISTS public.pessoa_papeis (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    papel VARCHAR(30) NOT NULL CHECK (papel IN
        ('cliente','fornecedor','vendedor','funcionario','entregador','oficina','mecanico','custom')),
    papel_custom VARCHAR(60),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (papel <> 'custom' OR papel_custom IS NOT NULL),
    UNIQUE (pessoa_id, papel, papel_custom)
);
CREATE INDEX IF NOT EXISTS idx_pessoa_papeis_pessoa ON public.pessoa_papeis (pessoa_id);

-- ===== Contatos (N, com destino de fechamento/cobrança) =====

CREATE TABLE IF NOT EXISTS public.pessoa_contatos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    canal VARCHAR(15) NOT NULL CHECK (canal IN ('email','whatsapp','sms')),
    valor_cifrado BYTEA,            -- contato cifrado na aplicação
    valor_bidx BYTEA,               -- blind index p/ busca
    rotulo VARCHAR(60),             -- "secretária", "contador"...
    recebe_fechamento BOOLEAN NOT NULL DEFAULT false,
    recebe_cobranca BOOLEAN NOT NULL DEFAULT false,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pessoa_contatos_pessoa ON public.pessoa_contatos (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pessoa_contatos_bidx ON public.pessoa_contatos (valor_bidx);

-- ===== Endereços (N) =====

CREATE TABLE IF NOT EXISTS public.pessoa_enderecos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    cep VARCHAR(9),
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf CHAR(2),
    principal BOOLEAN NOT NULL DEFAULT false,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pessoa_enderecos_pessoa ON public.pessoa_enderecos (pessoa_id);

-- ===== Veículos relacionados (COM exclusão — corrige dor do SS Plus) =====

CREATE TABLE IF NOT EXISTS public.pessoa_veiculos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    placa VARCHAR(10),
    veiculo VARCHAR(120),
    marca VARCHAR(60),
    ano VARCHAR(9),
    chassi_cifrado BYTEA,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pessoa_veiculos_pessoa ON public.pessoa_veiculos (pessoa_id);

-- ===== Regras por unidade (desconto/formas/vendedores/entrega) =====

CREATE TABLE IF NOT EXISTS public.pessoa_regras_unidade (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    unidade_id BIGINT NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
    desconto_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
    formas_pagamento TEXT[] NOT NULL DEFAULT '{}',
    vendedores_autorizados BIGINT[] NOT NULL DEFAULT '{}',
    modo_entrega VARCHAR(20),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pessoa_id, unidade_id)
);
CREATE INDEX IF NOT EXISTS idx_pessoa_regras_pessoa ON public.pessoa_regras_unidade (pessoa_id);

-- ===== Auditoria mínima (quem alterou o quê) =====

CREATE TABLE IF NOT EXISTS public.auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT,
    tabela VARCHAR(63) NOT NULL,
    registro_id BIGINT,
    acao VARCHAR(10) NOT NULL CHECK (acao IN ('INSERT','UPDATE','DELETE')),
    ator_user_id UUID,
    diff JSONB,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_org_data ON public.auditoria (organizacao_id, criado_em DESC);

-- ===== Compat com clientes/orçamentos existentes =====
-- orcamentos passa a poder referenciar pessoas (nullable durante a transição).
ALTER TABLE public.orcamentos
    ADD COLUMN IF NOT EXISTS pessoa_id BIGINT REFERENCES public.pessoas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orcamentos_pessoa ON public.orcamentos (pessoa_id);

-- ===== Helpers de RLS (organização do usuário) =====
-- SECURITY DEFINER em schema privado, sempre filtrando por auth.uid().

CREATE OR REPLACE FUNCTION private.organizacao_ids_do_usuario()
RETURNS SETOF BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT DISTINCT l.organizacao_id
    FROM public.membros_loja m
    JOIN public.lojas l ON l.id = m.loja_id
    WHERE m.user_id = auth.uid()
      AND l.organizacao_id IS NOT NULL
$$;

REVOKE ALL ON FUNCTION private.organizacao_ids_do_usuario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.organizacao_ids_do_usuario() TO authenticated;

-- ===== Gatilho de atualizado_em =====

CREATE OR REPLACE FUNCTION private.set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pessoas_atualizado_em ON public.pessoas;
CREATE TRIGGER trg_pessoas_atualizado_em
    BEFORE UPDATE ON public.pessoas
    FOR EACH ROW EXECUTE FUNCTION private.set_atualizado_em();

-- ===== RLS =====

ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoa_papeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoa_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoa_enderecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoa_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoa_regras_unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- organizacoes / unidades / grupos: membro da org lê
CREATE POLICY organizacoes_select ON public.organizacoes
    FOR SELECT TO authenticated
    USING (id IN (SELECT private.organizacao_ids_do_usuario()));

CREATE POLICY unidades_select ON public.unidades
    FOR SELECT TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

CREATE POLICY grupos_all ON public.grupos_comerciais
    FOR ALL TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()))
    WITH CHECK (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

-- pessoas: CRUD isolado por organização
CREATE POLICY pessoas_select ON public.pessoas
    FOR SELECT TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));
CREATE POLICY pessoas_insert ON public.pessoas
    FOR INSERT TO authenticated
    WITH CHECK (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));
CREATE POLICY pessoas_update ON public.pessoas
    FOR UPDATE TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()))
    WITH CHECK (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));
CREATE POLICY pessoas_delete ON public.pessoas
    FOR DELETE TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

-- filhas de pessoa: seguem a pessoa (subquery na org)
DO $$
DECLARE
    t TEXT;
    tabelas TEXT[] := ARRAY[
        'pessoa_papeis','pessoa_contatos','pessoa_enderecos',
        'pessoa_veiculos','pessoa_regras_unidade'
    ];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        EXECUTE format($f$
            CREATE POLICY %1$s_all ON public.%1$s
                FOR ALL TO authenticated
                USING (pessoa_id IN (
                    SELECT id FROM public.pessoas
                    WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
                ))
                WITH CHECK (pessoa_id IN (
                    SELECT id FROM public.pessoas
                    WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
                ));
        $f$, t);
    END LOOP;
END;
$$;

-- auditoria: membro da org lê; escrita só via service_role (pipeline/trigger)
CREATE POLICY auditoria_select ON public.auditoria
    FOR SELECT TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

-- ===== Anti mass assignment: colunas nunca alteráveis pós-criação =====
-- organizacao_id/documento_bidx são definidos na criação; UPDATE não pode trocá-los
-- pelo cliente. A defesa primária é RLS + whitelist na aplicação; aqui reforçamos
-- revogando UPDATE dessas colunas do papel authenticated.
REVOKE UPDATE (organizacao_id) ON public.pessoas FROM authenticated;
