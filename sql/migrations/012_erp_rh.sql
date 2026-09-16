-- ERP 2.0 — Módulo RH / Departamento Pessoal (escopo intermediário, SEM eSocial)
-- Base: docs/erp-2.0 + plano modulo_rh. O funcionário é uma Pessoa (papel 'funcionario',
-- migration 007); o RH adiciona o "lado trabalhista" e a gestão (férias, folha, holerite,
-- afastamentos, advertências, rescisão, documentos).
--
-- Cripto seletiva na aplicação (src/lib/crypto): salário, dados bancários e CID (atestado)
-- vão em colunas *_cifrado (bytea). RLS por organização, no padrão da migration 007.

-- ===== Catálogo: novo módulo 'rh' =====
INSERT INTO public.modulos (chave, nome, descricao) VALUES
    ('rh', 'RH / Departamento Pessoal', 'Ficha trabalhista, férias, folha mensal, holerite, rescisão')
ON CONFLICT (chave) DO NOTHING;

-- ===== Ficha trabalhista (contrato) =====
CREATE TABLE IF NOT EXISTS public.rh_contratos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    pessoa_id BIGINT NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    matricula VARCHAR(30),
    cargo VARCHAR(120),
    cbo VARCHAR(10),
    departamento VARCHAR(120),
    admissao DATE,
    tipo_contrato VARCHAR(15) NOT NULL DEFAULT 'clt'
        CHECK (tipo_contrato IN ('clt','experiencia','estagio','pj','temporario')),
    jornada_horas_semana NUMERIC(5,2) NOT NULL DEFAULT 44,
    salario_base_cifrado BYTEA,        -- cifrado na aplicação
    dados_bancarios_cifrado BYTEA,     -- cifrado na aplicação
    sindicato VARCHAR(120),
    status VARCHAR(12) NOT NULL DEFAULT 'ativo'
        CHECK (status IN ('ativo','afastado','desligado')),
    desligamento_em DATE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pessoa_id)
);
CREATE INDEX IF NOT EXISTS idx_rh_contratos_org ON public.rh_contratos (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_rh_contratos_status ON public.rh_contratos (organizacao_id, status);

-- ===== Dependentes (IRRF / salário-família) =====
CREATE TABLE IF NOT EXISTS public.rh_dependentes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contrato_id BIGINT NOT NULL REFERENCES public.rh_contratos(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    nascimento DATE,
    parentesco VARCHAR(30),
    para_irrf BOOLEAN NOT NULL DEFAULT false,
    para_salario_familia BOOLEAN NOT NULL DEFAULT false,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_dependentes_contrato ON public.rh_dependentes (contrato_id);

-- ===== Férias =====
CREATE TABLE IF NOT EXISTS public.rh_ferias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contrato_id BIGINT NOT NULL REFERENCES public.rh_contratos(id) ON DELETE CASCADE,
    aquisitivo_inicio DATE,
    aquisitivo_fim DATE,
    concessivo_ate DATE,
    dias_gozo INTEGER NOT NULL DEFAULT 30 CHECK (dias_gozo BETWEEN 1 AND 30),
    data_inicio_gozo DATE,
    abono_pecuniario_dias INTEGER NOT NULL DEFAULT 0 CHECK (abono_pecuniario_dias BETWEEN 0 AND 10),
    valor_calculado NUMERIC(12,2),
    status VARCHAR(12) NOT NULL DEFAULT 'agendada'
        CHECK (status IN ('agendada','gozada','paga')),
    observacao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_ferias_contrato ON public.rh_ferias (contrato_id);

-- ===== Afastamentos / atestados =====
CREATE TABLE IF NOT EXISTS public.rh_afastamentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contrato_id BIGINT NOT NULL REFERENCES public.rh_contratos(id) ON DELETE CASCADE,
    tipo VARCHAR(15) NOT NULL DEFAULT 'atestado'
        CHECK (tipo IN ('atestado','inss','licenca','outro')),
    cid_cifrado BYTEA,                 -- dado sensível de saúde: cifrado
    inicio DATE NOT NULL,
    fim DATE,
    dias INTEGER,
    documento_url TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_afastamentos_contrato ON public.rh_afastamentos (contrato_id);

-- ===== Advertências / medidas disciplinares =====
CREATE TABLE IF NOT EXISTS public.rh_advertencias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contrato_id BIGINT NOT NULL REFERENCES public.rh_contratos(id) ON DELETE CASCADE,
    tipo VARCHAR(12) NOT NULL DEFAULT 'escrita'
        CHECK (tipo IN ('verbal','escrita','suspensao')),
    motivo TEXT NOT NULL,
    data DATE NOT NULL,
    documento_url TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_advertencias_contrato ON public.rh_advertencias (contrato_id);

-- ===== Folha mensal (competência + itens por funcionário) =====
CREATE TABLE IF NOT EXISTS public.rh_folha_competencias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacao_id BIGINT NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    status VARCHAR(10) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechado_em TIMESTAMPTZ,
    UNIQUE (organizacao_id, ano, mes)
);
CREATE INDEX IF NOT EXISTS idx_rh_folha_comp_org ON public.rh_folha_competencias (organizacao_id, ano DESC, mes DESC);

CREATE TABLE IF NOT EXISTS public.rh_folha_itens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    competencia_id BIGINT NOT NULL REFERENCES public.rh_folha_competencias(id) ON DELETE CASCADE,
    contrato_id BIGINT NOT NULL REFERENCES public.rh_contratos(id) ON DELETE CASCADE,
    salario_base NUMERIC(12,2) NOT NULL DEFAULT 0,
    proventos JSONB NOT NULL DEFAULT '[]',   -- [{descricao, valor}]
    descontos JSONB NOT NULL DEFAULT '[]',
    inss NUMERIC(12,2) NOT NULL DEFAULT 0,
    irrf NUMERIC(12,2) NOT NULL DEFAULT 0,
    fgts NUMERIC(12,2) NOT NULL DEFAULT 0,    -- informativo (não recolhe)
    total_proventos NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_descontos NUMERIC(12,2) NOT NULL DEFAULT 0,
    liquido NUMERIC(12,2) NOT NULL DEFAULT 0,
    holerite_url TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (competencia_id, contrato_id)
);
CREATE INDEX IF NOT EXISTS idx_rh_folha_itens_comp ON public.rh_folha_itens (competencia_id);
CREATE INDEX IF NOT EXISTS idx_rh_folha_itens_contrato ON public.rh_folha_itens (contrato_id);

-- ===== Rescisão =====
CREATE TABLE IF NOT EXISTS public.rh_rescisoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contrato_id BIGINT NOT NULL REFERENCES public.rh_contratos(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('sem_justa_causa','pedido_demissao','justa_causa','acordo','fim_contrato')),
    motivo TEXT,
    aviso_tipo VARCHAR(15) CHECK (aviso_tipo IN ('trabalhado','indenizado','dispensado')),
    data_aviso DATE,
    data_desligamento DATE NOT NULL,
    verbas JSONB NOT NULL DEFAULT '[]',      -- [{descricao, valor, tipo:'provento'|'desconto'}]
    checklist JSONB NOT NULL DEFAULT '[]',   -- [{item, ok}]
    documento_url TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (contrato_id)
);
CREATE INDEX IF NOT EXISTS idx_rh_rescisoes_contrato ON public.rh_rescisoes (contrato_id);

-- ===== Documentos do funcionário =====
CREATE TABLE IF NOT EXISTS public.rh_documentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contrato_id BIGINT NOT NULL REFERENCES public.rh_contratos(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL DEFAULT 'outro'
        CHECK (tipo IN ('contrato','aso','rg','ctps','comprovante','outro')),
    arquivo_url TEXT NOT NULL,
    validade DATE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_documentos_contrato ON public.rh_documentos (contrato_id);

-- ===== Tabelas legais (nacionais, configuráveis por ano) =====
-- NÃO são por tenant: valem para todos. Leitura por qualquer autenticado; escrita
-- só super admin. O cálculo (src/lib/rh) recebe as faixas como parâmetro.
CREATE TABLE IF NOT EXISTS public.rh_tabelas_legais (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vigencia_ano INTEGER NOT NULL,
    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('inss','irrf','salario_familia','fgts','salario_minimo')),
    faixas JSONB NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vigencia_ano, tipo)
);

-- ===== Trigger atualizado_em (função criada na 007) =====
DROP TRIGGER IF EXISTS trg_rh_contratos_atualizado_em ON public.rh_contratos;
CREATE TRIGGER trg_rh_contratos_atualizado_em
    BEFORE UPDATE ON public.rh_contratos
    FOR EACH ROW EXECUTE FUNCTION private.set_atualizado_em();

-- ===== RLS =====
ALTER TABLE public.rh_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_dependentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_afastamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_advertencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_folha_competencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_folha_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_rescisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_tabelas_legais ENABLE ROW LEVEL SECURITY;

-- Contratos e competências: CRUD isolado por organização.
DROP POLICY IF EXISTS rh_contratos_all ON public.rh_contratos;
CREATE POLICY rh_contratos_all ON public.rh_contratos
    FOR ALL TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()))
    WITH CHECK (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

DROP POLICY IF EXISTS rh_folha_comp_all ON public.rh_folha_competencias;
CREATE POLICY rh_folha_comp_all ON public.rh_folha_competencias
    FOR ALL TO authenticated
    USING (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()))
    WITH CHECK (organizacao_id IN (SELECT private.organizacao_ids_do_usuario()));

-- Filhas de contrato: seguem a organização do contrato.
DO $$
DECLARE
    t TEXT;
    tabelas TEXT[] := ARRAY[
        'rh_dependentes','rh_ferias','rh_afastamentos',
        'rh_advertencias','rh_rescisoes','rh_documentos'
    ];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        EXECUTE format($f$
            DROP POLICY IF EXISTS %1$s_all ON public.%1$s;
            CREATE POLICY %1$s_all ON public.%1$s
                FOR ALL TO authenticated
                USING (contrato_id IN (
                    SELECT id FROM public.rh_contratos
                    WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
                ))
                WITH CHECK (contrato_id IN (
                    SELECT id FROM public.rh_contratos
                    WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
                ));
        $f$, t);
    END LOOP;
END;
$$;

-- Itens da folha: seguem a organização da competência.
DROP POLICY IF EXISTS rh_folha_itens_all ON public.rh_folha_itens;
CREATE POLICY rh_folha_itens_all ON public.rh_folha_itens
    FOR ALL TO authenticated
    USING (competencia_id IN (
        SELECT id FROM public.rh_folha_competencias
        WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
    ))
    WITH CHECK (competencia_id IN (
        SELECT id FROM public.rh_folha_competencias
        WHERE organizacao_id IN (SELECT private.organizacao_ids_do_usuario())
    ));

-- Tabelas legais: qualquer autenticado lê; só super admin escreve.
DROP POLICY IF EXISTS rh_tabelas_legais_select ON public.rh_tabelas_legais;
CREATE POLICY rh_tabelas_legais_select ON public.rh_tabelas_legais
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rh_tabelas_legais_write_super ON public.rh_tabelas_legais;
CREATE POLICY rh_tabelas_legais_write_super ON public.rh_tabelas_legais
    FOR ALL TO authenticated
    USING (private.usuario_e_super_admin())
    WITH CHECK (private.usuario_e_super_admin());

-- Anti mass assignment: organizacao_id do contrato é imutável pós-criação.
REVOKE UPDATE (organizacao_id) ON public.rh_contratos FROM authenticated;

-- ===== Bucket privado 'rh' (holerites, atestados, documentos) =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('rh', 'rh', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS rh_bucket_select ON storage.objects;
CREATE POLICY rh_bucket_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'rh'
        AND (storage.foldername(name))[1] ~ '^[0-9]+$'
        AND ((storage.foldername(name))[1])::bigint IN (SELECT private.organizacao_ids_do_usuario())
    );

DROP POLICY IF EXISTS rh_bucket_insert ON storage.objects;
CREATE POLICY rh_bucket_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'rh'
        AND (storage.foldername(name))[1] ~ '^[0-9]+$'
        AND ((storage.foldername(name))[1])::bigint IN (SELECT private.organizacao_ids_do_usuario())
    );

DROP POLICY IF EXISTS rh_bucket_delete ON storage.objects;
CREATE POLICY rh_bucket_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'rh'
        AND (storage.foldername(name))[1] ~ '^[0-9]+$'
        AND ((storage.foldername(name))[1])::bigint IN (SELECT private.organizacao_ids_do_usuario())
    );

-- ===== Seed das tabelas legais (base 2025 oficial; CONFIRMAR 2026 com o contador) =====
INSERT INTO public.rh_tabelas_legais (vigencia_ano, tipo, faixas) VALUES
    (2026, 'inss', '{"faixas":[{"ate":1518.00,"aliquota":0.075},{"ate":2793.88,"aliquota":0.09},{"ate":4190.83,"aliquota":0.12},{"ate":8157.41,"aliquota":0.14}],"teto":8157.41}'),
    (2026, 'irrf', '{"faixas":[{"ate":2259.20,"aliquota":0,"deducao":0},{"ate":2826.65,"aliquota":0.075,"deducao":169.44},{"ate":3751.05,"aliquota":0.15,"deducao":381.44},{"ate":4664.68,"aliquota":0.225,"deducao":662.77},{"ate":null,"aliquota":0.275,"deducao":896.00}],"deducao_dependente":189.59,"desconto_simplificado":607.20}'),
    (2026, 'salario_familia', '{"teto_salario":1819.26,"valor_cota":65.00}'),
    (2026, 'fgts', '{"aliquota":0.08}'),
    (2026, 'salario_minimo', '{"valor":1518.00}')
ON CONFLICT (vigencia_ano, tipo) DO NOTHING;

-- fiscal/marketing começam globalmente desligados (008); rh entra ligado globalmente
-- e é liberado por loja no painel super admin.
