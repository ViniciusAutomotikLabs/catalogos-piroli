# Handoff Backend — Evolução da API TecDoc na VPS

## Status de implantação — 18/07/2026

**Implantado e validado na VPS.**

| Item | Estado |
|---|---|
| Backup pré-deploy | `/root/tecdoc-backup-20260718-124027` |
| API legada | preservada e respondendo HTTP 200 |
| `view_tecdoc_artigos_v2` | implantada |
| `view_tecdoc_aplicacoes_v2` | implantada |
| `view_tecdoc_referencias_v2` | implantada |
| `view_tecdoc_imagens_v2` | implantada |
| `view_tecdoc_especificacoes_v2` | implantada |
| Código/OEM normalizados | índices válidos |
| Primeira JPEG por artigo | índice parcial válido |
| PostgREST como superusuário | corrigido; usa `postgrest_authenticator` limitado |
| Limite global | `PGRST_DB_MAX_ROWS=100` |
| Timeout | 5s por consulta; 10s idle em transação |
| Container anterior para rollback | `postgrest-legacy-20260718-125920` |

Migrações auditáveis:

- `sql/vps/tecdoc_api_v2_indexes.sql`
- `sql/vps/tecdoc_api_v2_views.sql`

Validações concluídas:

- endpoints legado e v2 retornam HTTP 200;
- tabelas-base retornam 401 para acesso anônimo;
- busca por `article_number_normalized` e `oem_number_normalized` usa índice;
- cardinalidade de aplicações, referências e especificações foi preservada;
- consultas externas ficaram abaixo de 100 ms nos testes executados;
- chamadas sem `limit` retornam no máximo 100 linhas.

Pendências operacionais que não bloqueiam a API v2:

1. colocar a API atrás de HTTPS, autenticação e rate limit;
2. bloquear a exposição pública direta da porta 3005 após validar o proxy;
3. rotacionar a senha da role `postgres` somente após mapear e atualizar a dependência do PgBouncer;
4. integrar os novos endpoints no Catálogo Industrial.

---

**Objetivo:** disponibilizar aplicações veiculares estruturadas, códigos de artigo, fabricante/marca, referências cruzadas e referências OEM para o Catálogo Industrial, mantendo compatibilidade com a API TecDoc atual.

**Público:** desenvolvedor backend/infra responsável pela VPS, PostgreSQL e PostgREST.

**Banco:** `tecdoc_catalog`  
**Container PostgreSQL:** `tecdoc_postgres`  
**Container/API:** PostgREST 14  
**Endpoint legado:** `GET /view_busca_catalogo`

> Este documento foi produzido a partir do arquivo **“TecDoc Catalog API - Documentação Completa e Arquitetura (Definitiva) V2”**, do contrato atualmente consumido pelo aplicativo e da inspeção da API pública.

---

## 1. Resultado esperado

Ao final da implementação, a API deve expor recursos separados:

| Recurso | Cardinalidade | Finalidade |
|---|---:|---|
| `view_tecdoc_artigos_v2` | 1 linha por artigo | descrição, código, fabricante/marca e imagem principal |
| `view_tecdoc_aplicacoes_v2` | 1 linha por artigo + veículo | modelo, versão, motor, ano e demais aplicações disponíveis |
| `view_tecdoc_referencias_v2` | 1 linha por artigo + referência | OEM, fabricante, concorrente e demais referências cruzadas |
| `view_tecdoc_imagens_v2` | 1 linha por imagem | galeria de imagens JPEG por artigo |
| `view_busca_catalogo` | muitas linhas por artigo | endpoint legado; deve permanecer funcionando durante a migração |

Não criar uma única view juntando aplicações, referências e imagens.

Exemplo: um artigo com 20 aplicações, 8 referências e 3 imagens produziria `20 × 8 × 3 = 480` linhas. No volume atual, essa multiplicação pode transformar dezenas de milhões de registros em centenas de milhões ou bilhões.

O fluxo correto no aplicativo será:

1. localizar o artigo por descrição, código, referência ou veículo;
2. obter os dados básicos em `view_tecdoc_artigos_v2`;
3. carregar aplicações por `article_id` em `view_tecdoc_aplicacoes_v2`;
4. carregar OEM/referências por `article_id` em `view_tecdoc_referencias_v2`.

---

## 2. O que está confirmado

### 2.1 Infraestrutura

- PostgreSQL executa no container `tecdoc_postgres`;
- banco: `tecdoc_catalog`;
- PostgREST está na mesma rede Docker;
- porta interna do PostgREST: `3000`;
- porta externa atual: `3005`;
- schema exposto atualmente: `public`;
- role anônima atual: `web_anon`;
- a API contém mais de 60 milhões de linhas na view de busca;
- `description` está em inglês.

### 2.2 Tabelas e colunas confirmadas

As seguintes relações e colunas estão confirmadas pela view atual:

```text
articles
  id
  description

article_vehicles
  article_id
  vehicle_id

vehicles
  id
  description
  model_id

models
  id
  name

article_media
  id
  article_id
  s3_url
  media_type
```

Também foram detectadas no banco, mas seus campos e relacionamentos ainda não foram confirmados:

```text
brands
manufacturers
cross_references
engines
```

### 2.3 SQL da view legada

A documentação informa que a view atual foi criada assim:

```sql
CREATE OR REPLACE VIEW public.view_busca_catalogo AS
SELECT
  a.id AS article_id,
  a.description,
  v.id AS vehicle_id,
  v.description AS vehicle_desc,
  mo.name AS model_name,
  am.s3_url AS image_url
FROM public.articles a
JOIN public.article_vehicles av
  ON a.id = av.article_id
JOIN public.vehicles v
  ON av.vehicle_id = v.id
JOIN public.models mo
  ON v.model_id = mo.id
LEFT JOIN (
  SELECT DISTINCT ON (article_id)
    article_id,
    s3_url
  FROM public.article_media
  WHERE media_type = 'JPEG'
  ORDER BY article_id, id
) am
  ON a.id = am.article_id;
```

Essa view não deve ser removida nem ter colunas renomeadas nesta entrega.

---

## 3. Regras críticas antes de executar

1. Fazer backup/snapshot antes da alteração.
2. Executar primeiro toda a etapa de descoberta do schema.
3. Não presumir nomes de colunas em `cross_references`, `brands`, `manufacturers` ou `engines`.
4. Não executar nenhum SQL que contenha `__PLACEHOLDER__`.
5. Criar índices grandes com `CONCURRENTLY`, fora de transações.
6. Não liberar `SELECT` direto nas tabelas-base para `web_anon`.
7. Manter `view_busca_catalogo` durante toda a migração.
8. Todas as chamadas PostgREST devem possuir `limit`.
9. Não executar `count=exact` sobre views com dezenas de milhões de linhas em horário de uso.
10. Não conectar o PostgREST como `postgres` ou outro superusuário.
11. A sequência oficial de execução é a seção 13; a ordem numérica das seções serve como referência técnica, não como roteiro de execução.
12. Só aplicar `statement_timeout` de 5 segundos depois de criar os índices confirmados e provar que o endpoint legado responde dentro desse limite.

---

## 4. Acesso à VPS e backup

### 4.1 Abrir o `psql`

Executar no host da VPS:

```bash
docker exec -it tecdoc_postgres \
  psql -U postgres -d tecdoc_catalog
```

No `psql`, habilitar interrupção em qualquer erro:

```sql
\set ON_ERROR_STOP on
\timing on
```

### 4.2 Capturar definições antes da mudança

No host:

```bash
mkdir -p ~/tecdoc-backup-$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=$(ls -dt ~/tecdoc-backup-* | head -1)

docker exec tecdoc_postgres \
  pg_dump -U postgres -d tecdoc_catalog \
  --schema-only \
  --no-owner \
  --no-privileges \
  > "$BACKUP_DIR/schema-before.sql"

docker exec tecdoc_postgres \
  pg_dump -U postgres -d tecdoc_catalog \
  --schema-only \
  --table=public.view_busca_catalogo \
  > "$BACKUP_DIR/view-busca-before.sql"
```

Salvar também grants, roles e configuração:

```bash
docker exec tecdoc_postgres \
  psql -U postgres -d tecdoc_catalog -P pager=off \
  -c "\du+" \
  > "$BACKUP_DIR/roles-before.txt"

docker exec tecdoc_postgres \
  psql -U postgres -d tecdoc_catalog -P pager=off \
  -c "\dp public.*" \
  > "$BACKUP_DIR/grants-before.txt"

docker inspect postgrest \
  > "$BACKUP_DIR/postgrest-inspect-before.json"
```

Para backup lógico dos dados relacionados, confirmar primeiro se há espaço em disco. As tabelas podem ser muito grandes:

```bash
df -h
docker exec tecdoc_postgres \
  psql -U postgres -d tecdoc_catalog \
  -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

Se houver política de snapshot do provedor/Easypanel, criar snapshot do volume do PostgreSQL antes do deploy.

---

## 5. Descoberta obrigatória do schema

Esta etapa elimina suposições sobre os nomes dos campos de OEM, código, fabricante, motor e anos.

### 5.1 Versão, banco e usuário

```sql
SELECT
  current_database() AS database_name,
  current_setting('server_version') AS server_version,
  current_user,
  session_user;
```

### 5.2 Relações, tamanho e estimativa de linhas

```sql
SELECT
  n.nspname AS schema_name,
  c.relname AS relation_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    ELSE c.relkind::text
  END AS relation_type,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  c.reltuples::bigint AS estimated_rows
FROM pg_class c
JOIN pg_namespace n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'articles',
    'article_vehicles',
    'vehicles',
    'models',
    'article_media',
    'brands',
    'manufacturers',
    'cross_references',
    'engines',
    'view_busca_catalogo'
  )
ORDER BY c.relname;
```

### 5.3 Colunas, tipos e nulabilidade

```sql
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  is_identity,
  is_generated,
  generation_expression
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'articles',
    'article_vehicles',
    'vehicles',
    'models',
    'article_media',
    'brands',
    'manufacturers',
    'cross_references',
    'engines'
  )
ORDER BY table_name, ordinal_position;
```

Exportar o resultado para arquivo:

```bash
docker exec tecdoc_postgres \
  psql -U postgres -d tecdoc_catalog -P pager=off -F $'\t' -A \
  -c "
    SELECT table_name, ordinal_position, column_name, data_type,
           udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'articles','article_vehicles','vehicles','models','article_media',
        'brands','manufacturers','cross_references','engines'
      )
    ORDER BY table_name, ordinal_position;
  " > tecdoc-columns.tsv
```

### 5.4 Chaves primárias, únicas e estrangeiras

```sql
SELECT
  ns.nspname AS schema_name,
  tbl.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE con.contype::text
  END AS constraint_type,
  pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class tbl
  ON tbl.oid = con.conrelid
JOIN pg_namespace ns
  ON ns.oid = tbl.relnamespace
WHERE ns.nspname = 'public'
  AND tbl.relname IN (
    'articles',
    'article_vehicles',
    'vehicles',
    'models',
    'article_media',
    'brands',
    'manufacturers',
    'cross_references',
    'engines'
  )
ORDER BY tbl.relname, con.contype, con.conname;
```

Mapeamento detalhado das FKs:

```sql
SELECT
  src.relname AS source_table,
  src_col.attname AS source_column,
  dst.relname AS target_table,
  dst_col.attname AS target_column,
  con.conname AS constraint_name
FROM pg_constraint con
JOIN pg_class src
  ON src.oid = con.conrelid
JOIN pg_namespace src_ns
  ON src_ns.oid = src.relnamespace
JOIN pg_class dst
  ON dst.oid = con.confrelid
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY src_key(attnum, ord)
  ON true
JOIN LATERAL unnest(con.confkey) WITH ORDINALITY dst_key(attnum, ord)
  ON dst_key.ord = src_key.ord
JOIN pg_attribute src_col
  ON src_col.attrelid = src.oid
 AND src_col.attnum = src_key.attnum
JOIN pg_attribute dst_col
  ON dst_col.attrelid = dst.oid
 AND dst_col.attnum = dst_key.attnum
WHERE con.contype = 'f'
  AND src_ns.nspname = 'public'
  AND (
    src.relname IN (
      'articles','article_vehicles','vehicles','models','article_media',
      'brands','manufacturers','cross_references','engines'
    )
    OR dst.relname IN (
      'articles','vehicles','models','brands','manufacturers','engines'
    )
  )
ORDER BY src.relname, con.conname, src_key.ord;
```

### 5.5 Índices existentes

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'articles',
    'article_vehicles',
    'vehicles',
    'models',
    'article_media',
    'brands',
    'manufacturers',
    'cross_references',
    'engines'
  )
ORDER BY tablename, indexname;
```

### 5.6 Localizar campos semanticamente relevantes

Esta consulta apenas encontra candidatos; ela não confirma o significado dos campos:

```sql
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'articles',
    'vehicles',
    'models',
    'brands',
    'manufacturers',
    'cross_references',
    'engines'
  )
  AND column_name ~* (
    'code|number|reference|xref|cross|oem|oe_|brand|' ||
    'manufacturer|supplier|engine|year|date|fuel|body|' ||
    'power|capacity|article|vehicle|model'
  )
ORDER BY table_name, ordinal_position;
```

Procurar também tabelas de códigos/OEM que não estavam na lista inicialmente conhecida:

```sql
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    table_name ~* 'article|code|number|reference|xref|cross|oem|oe'
    OR column_name ~* 'article|code|number|reference|xref|cross|oem|oe'
  )
ORDER BY table_name, ordinal_position;
```

### 5.7 Amostras controladas

Após conhecer as colunas, consultar poucas linhas:

```sql
SELECT * FROM public.articles LIMIT 5;
SELECT * FROM public.cross_references LIMIT 20;
SELECT * FROM public.brands LIMIT 5;
SELECT * FROM public.manufacturers LIMIT 5;
SELECT * FROM public.engines LIMIT 5;
```

Para não exibir colunas grandes/binárias no terminal:

```sql
\x on
SELECT * FROM public.cross_references LIMIT 3;
\x off
```

### 5.8 Decisões que devem ser registradas

Antes de continuar, preencher:

```text
Código principal do artigo:
  tabela:
  coluna:
  exemplo:

FK artigo → marca/fabricante:
  tabela/coluna de origem:
  tabela/coluna de destino:

Referência cruzada:
  PK:
  FK para article_id:
  valor da referência:
  tipo da referência:
  marca/fabricante da referência:

OEM:
  está em cross_references?:
  como o tipo OEM é identificado?:
  exemplo real:

Aplicação:
  FK veículo → engine:
  início/fim de fabricação:
  combustível:
  potência/cilindrada:
```

Não classificar toda referência como OEM sem confirmar a coluna de tipo/origem.

---

## 6. Migração base usando somente colunas confirmadas

Esta etapa só deve ser executada após concluir a descoberta da seção 5 e confirmar que todas as colunas utilizadas continuam presentes. Ela cria endpoints separados para artigo, aplicação e imagem, sem depender dos campos ainda desconhecidos.

### 6.1 Criar as views

```sql
BEGIN;

CREATE OR REPLACE VIEW public.view_tecdoc_artigos_v2
WITH (security_barrier = true)
AS
SELECT
  a.id AS article_id,
  a.description,
  am.s3_url AS image_url
FROM public.articles a
LEFT JOIN LATERAL (
  SELECT media.s3_url
  FROM public.article_media media
  WHERE media.article_id = a.id
    AND media.media_type = 'JPEG'
  ORDER BY media.id
  LIMIT 1
) am ON true;

COMMENT ON VIEW public.view_tecdoc_artigos_v2 IS
  'API v2: uma linha por artigo; não contém aplicações ou referências.';

CREATE OR REPLACE VIEW public.view_tecdoc_aplicacoes_v2
WITH (security_barrier = true)
AS
SELECT
  av.article_id,
  v.id AS vehicle_id,
  mo.id AS model_id,
  mo.name AS model_name,
  v.description AS vehicle_description
FROM public.article_vehicles av
JOIN public.vehicles v
  ON v.id = av.vehicle_id
JOIN public.models mo
  ON mo.id = v.model_id;

COMMENT ON VIEW public.view_tecdoc_aplicacoes_v2 IS
  'API v2: aplicações separadas, uma linha por artigo e veículo.';

CREATE OR REPLACE VIEW public.view_tecdoc_imagens_v2
WITH (security_barrier = true)
AS
SELECT
  am.id AS image_id,
  am.article_id,
  am.s3_url AS image_url,
  am.media_type
FROM public.article_media am
WHERE am.media_type = 'JPEG';

COMMENT ON VIEW public.view_tecdoc_imagens_v2 IS
  'API v2: imagens JPEG de artigos.';

REVOKE ALL ON public.view_tecdoc_artigos_v2 FROM PUBLIC;
REVOKE ALL ON public.view_tecdoc_aplicacoes_v2 FROM PUBLIC;
REVOKE ALL ON public.view_tecdoc_imagens_v2 FROM PUBLIC;

GRANT SELECT ON public.view_tecdoc_artigos_v2 TO web_anon;
GRANT SELECT ON public.view_tecdoc_aplicacoes_v2 TO web_anon;
GRANT SELECT ON public.view_tecdoc_imagens_v2 TO web_anon;

COMMIT;
```

### 6.2 Por que usar `LATERAL` na imagem principal

A consulta usa um índice parcial por `article_id` e encerra após encontrar a primeira JPEG. Isso evita materializar ou ordenar toda a tabela de mídia em cada uso da view.

O índice correspondente está na seção 8.

---

## 7. Migração funcional após a descoberta do schema

> **Não executar os blocos desta seção enquanto existir qualquer `__PLACEHOLDER__`.**

Os nomes devem ser substituídos exatamente pelos campos encontrados na seção 5.

### 7.1 Enriquecer artigos com código e fabricante

Antes de escolher o template, registrar se `brands` representa a marca do veículo, a marca comercial da peça ou outro domínio, e se `manufacturers` representa o fabricante da peça ou a montadora. Não tratar esses conceitos como sinônimos. O contrato público deve usar nomes semânticos explícitos, como `part_manufacturer_name`, `vehicle_brand_name` ou `oe_manufacturer_name`.

#### Cenário A — fabricante ligado diretamente ao artigo

```sql
-- NÃO EXECUTAR COM PLACEHOLDERS.

CREATE OR REPLACE VIEW public.view_tecdoc_artigos_v2
WITH (security_barrier = true)
AS
SELECT
  a.id AS article_id,
  a.description,
  am.s3_url AS image_url,
  a.__ARTICLE_CODE_COLUMN__::text AS article_code,
  upper(regexp_replace(
    btrim(a.__ARTICLE_CODE_COLUMN__::text),
    '[^[:alnum:]]',
    '',
    'g'
  )) AS article_code_normalized,
  mf.__MANUFACTURER_ID_COLUMN__ AS manufacturer_id,
  mf.__MANUFACTURER_NAME_COLUMN__ AS manufacturer_name
FROM public.articles a
LEFT JOIN public.manufacturers mf
  ON mf.__MANUFACTURER_ID_COLUMN__ = a.__ARTICLE_MANUFACTURER_FK__
LEFT JOIN LATERAL (
  SELECT media.s3_url
  FROM public.article_media media
  WHERE media.article_id = a.id
    AND media.media_type = 'JPEG'
  ORDER BY media.id
  LIMIT 1
) am ON true;
```

As três primeiras colunas mantêm exatamente a ordem, nome e tipo da view criada na Fase 3. PostgreSQL permite `CREATE OR REPLACE VIEW` quando novas colunas são acrescentadas ao final, mas não quando as colunas existentes são reordenadas ou renomeadas.

#### Cenário B — código/fabricante está em tabela de códigos

Se um artigo possuir vários códigos ou fornecedores, não duplicar `view_tecdoc_artigos_v2`. Criar uma view separada:

```sql
-- NÃO EXECUTAR COM PLACEHOLDERS.

CREATE OR REPLACE VIEW public.view_tecdoc_codigos_v2
WITH (security_barrier = true)
AS
SELECT
  ac.__ARTICLE_FK__ AS article_id,
  ac.__CODE_ID__ AS code_id,
  ac.__CODE_VALUE__::text AS code_value,
  upper(regexp_replace(
    btrim(ac.__CODE_VALUE__::text),
    '[^[:alnum:]]',
    '',
    'g'
  )) AS code_normalized,
  ac.__CODE_TYPE__::text AS code_type,
  mf.__MANUFACTURER_ID_COLUMN__ AS manufacturer_id,
  mf.__MANUFACTURER_NAME_COLUMN__ AS manufacturer_name
FROM public.__ARTICLE_CODES_TABLE__ ac
LEFT JOIN public.manufacturers mf
  ON mf.__MANUFACTURER_ID_COLUMN__ = ac.__MANUFACTURER_FK__;
```

### 7.2 Criar referências cruzadas/OEM

Contrato público desejado:

```text
reference_id
article_id
reference_value
reference_normalized
reference_type
manufacturer_id
manufacturer_name
is_oem
```

Template:

```sql
-- NÃO EXECUTAR COM PLACEHOLDERS.

CREATE OR REPLACE VIEW public.view_tecdoc_referencias_v2
WITH (security_barrier = true)
AS
SELECT
  cr.__REFERENCE_PRIMARY_KEY__ AS reference_id,
  cr.__ARTICLE_FOREIGN_KEY__ AS article_id,
  cr.__REFERENCE_VALUE_COLUMN__::text AS reference_value,
  upper(regexp_replace(
    btrim(cr.__REFERENCE_VALUE_COLUMN__::text),
    '[^[:alnum:]]',
    '',
    'g'
  )) AS reference_normalized,
  cr.__REFERENCE_TYPE_COLUMN__::text AS reference_type,
  mf.__MANUFACTURER_ID_COLUMN__ AS manufacturer_id,
  mf.__MANUFACTURER_NAME_COLUMN__ AS manufacturer_name,
  CASE
    WHEN cr.__REFERENCE_TYPE_COLUMN__::text IN (
      __LISTA_DE_VALORES_OEM_CONFIRMADOS__
    ) THEN true
    ELSE false
  END AS is_oem
FROM public.cross_references cr
LEFT JOIN public.manufacturers mf
  ON mf.__MANUFACTURER_ID_COLUMN__ = cr.__REFERENCE_MANUFACTURER_FK__;
```

Exemplo de substituição da lista, somente se os dados confirmarem:

```sql
-- Exemplo ilustrativo; não assumir estes valores.
IN ('OEM', 'OE', 'ORIGINAL')
```

Se OEM estiver em outra tabela, padronizar com `UNION ALL`:

```sql
-- NÃO EXECUTAR COM PLACEHOLDERS.

CREATE OR REPLACE VIEW public.view_tecdoc_referencias_v2
WITH (security_barrier = true)
AS
SELECT
  'cross:' || cr.__REFERENCE_PRIMARY_KEY__::text AS reference_id,
  cr.__ARTICLE_FOREIGN_KEY__ AS article_id,
  cr.__REFERENCE_VALUE_COLUMN__::text AS reference_value,
  upper(regexp_replace(
    btrim(cr.__REFERENCE_VALUE_COLUMN__::text),
    '[^[:alnum:]]', '', 'g'
  )) AS reference_normalized,
  cr.__REFERENCE_TYPE_COLUMN__::text AS reference_type,
  cr.__MANUFACTURER_FK__ AS manufacturer_id,
  crmf.__MANUFACTURER_NAME_COLUMN__::text AS manufacturer_name,
  false AS is_oem
FROM public.cross_references cr
LEFT JOIN public.manufacturers crmf
  ON crmf.__MANUFACTURER_ID_COLUMN__ = cr.__MANUFACTURER_FK__

UNION ALL

SELECT
  'oem:' || oe.__OEM_PRIMARY_KEY__::text AS reference_id,
  oe.__ARTICLE_FOREIGN_KEY__ AS article_id,
  oe.__OEM_VALUE_COLUMN__::text AS reference_value,
  upper(regexp_replace(
    btrim(oe.__OEM_VALUE_COLUMN__::text),
    '[^[:alnum:]]', '', 'g'
  )) AS reference_normalized,
  'OEM'::text AS reference_type,
  oe.__MANUFACTURER_FK__ AS manufacturer_id,
  oemf.__MANUFACTURER_NAME_COLUMN__::text AS manufacturer_name,
  true AS is_oem
FROM public.__OEM_TABLE__ oe
LEFT JOIN public.manufacturers oemf
  ON oemf.__MANUFACTURER_ID_COLUMN__ = oe.__MANUFACTURER_FK__;
```

Depois de criar a view:

```sql
REVOKE ALL ON public.view_tecdoc_referencias_v2 FROM PUBLIC;
GRANT SELECT ON public.view_tecdoc_referencias_v2 TO web_anon;
COMMENT ON VIEW public.view_tecdoc_referencias_v2 IS
  'API v2: referências cruzadas e OEM, separadas das aplicações.';
```

### 7.3 Enriquecer aplicações com motor e anos

Primeiro identificar a FK real. Ela pode estar em `vehicles`, em uma tabela associativa ou em outra dimensão.

Template quando o motor estiver diretamente em `vehicles`:

```sql
-- NÃO EXECUTAR COM PLACEHOLDERS.

CREATE OR REPLACE VIEW public.view_tecdoc_aplicacoes_v2
WITH (security_barrier = true)
AS
SELECT
  av.article_id,
  v.id AS vehicle_id,
  mo.id AS model_id,
  mo.name AS model_name,
  v.description AS vehicle_description,
  e.__ENGINE_ID_COLUMN__ AS engine_id,
  e.__ENGINE_NAME_COLUMN__::text AS engine_name,
  v.__YEAR_FROM_COLUMN__ AS year_from,
  v.__YEAR_TO_COLUMN__ AS year_to,
  v.__FUEL_COLUMN__::text AS fuel_type,
  v.__POWER_COLUMN__ AS power,
  v.__CAPACITY_COLUMN__ AS engine_capacity
FROM public.article_vehicles av
JOIN public.vehicles v
  ON v.id = av.vehicle_id
JOIN public.models mo
  ON mo.id = v.model_id
LEFT JOIN public.engines e
  ON e.__ENGINE_ID_COLUMN__ = v.__VEHICLE_ENGINE_FK__;
```

Se ano estiver armazenado como data, preservar a data e não converter para inteiro na view:

```sql
v.__DATE_FROM_COLUMN__ AS production_from,
v.__DATE_TO_COLUMN__ AS production_to
```

O frontend pode derivar o ano para exibição. Preservar o valor original evita perda de mês/dia.

### 7.4 Grants finais

Liberar apenas views existentes:

```sql
GRANT SELECT ON public.view_tecdoc_artigos_v2 TO web_anon;
GRANT SELECT ON public.view_tecdoc_aplicacoes_v2 TO web_anon;
GRANT SELECT ON public.view_tecdoc_imagens_v2 TO web_anon;
GRANT SELECT ON public.view_tecdoc_referencias_v2 TO web_anon;

-- Somente se criada:
-- GRANT SELECT ON public.view_tecdoc_codigos_v2 TO web_anon;
```

Não executar:

```sql
-- PROIBIDO:
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO web_anon;
-- GRANT ALL ON SCHEMA public TO web_anon;
```

---

## 8. Índices

As views normais não possuem índices próprios. Os índices devem ser criados nas tabelas-base.

### 8.1 Cuidados operacionais

- executar um índice por vez;
- usar `CREATE INDEX CONCURRENTLY`;
- não envolver `CONCURRENTLY` em `BEGIN/COMMIT`;
- monitorar CPU, I/O, disco e locks;
- verificar índice equivalente antes de criar;
- em tabelas muito grandes, executar em janela controlada.

### 8.2 Extensão para buscas textuais

No `psql`, como administrador:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 8.3 Índices confirmados

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  articles_description_trgm_idx
ON public.articles
USING gin (description gin_trgm_ops);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  vehicles_description_trgm_idx
ON public.vehicles
USING gin (description gin_trgm_ops);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  models_name_trgm_idx
ON public.models
USING gin (name gin_trgm_ops);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  article_vehicles_article_vehicle_idx
ON public.article_vehicles (article_id, vehicle_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  article_vehicles_vehicle_article_idx
ON public.article_vehicles (vehicle_id, article_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  article_media_jpeg_article_id_id_idx
ON public.article_media (article_id, id)
INCLUDE (s3_url)
WHERE media_type = 'JPEG';
```

### 8.4 Validar duplicidade de aplicação

```sql
SELECT
  article_id,
  vehicle_id,
  count(*) AS duplicate_count
FROM public.article_vehicles
GROUP BY article_id, vehicle_id
HAVING count(*) > 1
ORDER BY duplicate_count DESC
LIMIT 100;
```

Somente se retornar zero linhas e o negócio confirmar unicidade:

```sql
CREATE UNIQUE INDEX CONCURRENTLY
  article_vehicles_article_vehicle_uidx
ON public.article_vehicles (article_id, vehicle_id);
```

Não manter simultaneamente o índice normal e o único com as mesmas colunas. Após validar o único, remover o redundante:

```sql
DROP INDEX CONCURRENTLY IF EXISTS
  public.article_vehicles_article_vehicle_idx;
```

### 8.5 Índices de código e referência

Substituir os placeholders após a descoberta:

```sql
-- NÃO EXECUTAR COM PLACEHOLDERS.

CREATE INDEX CONCURRENTLY
  articles_code_normalized_idx
ON public.articles (
  upper(regexp_replace(
    btrim(__ARTICLE_CODE_COLUMN__::text),
    '[^[:alnum:]]',
    '',
    'g'
  ))
);
```

```sql
-- NÃO EXECUTAR COM PLACEHOLDERS.

CREATE INDEX CONCURRENTLY
  cross_references_normalized_idx
ON public.cross_references (
  upper(regexp_replace(
    btrim(__REFERENCE_VALUE_COLUMN__::text),
    '[^[:alnum:]]',
    '',
    'g'
  ))
);
```

```sql
-- NÃO EXECUTAR COM PLACEHOLDERS.

CREATE INDEX CONCURRENTLY
  cross_references_article_normalized_idx
ON public.cross_references (
  __ARTICLE_FOREIGN_KEY__,
  upper(regexp_replace(
    btrim(__REFERENCE_VALUE_COLUMN__::text),
    '[^[:alnum:]]',
    '',
    'g'
  ))
);
```

Antes de adotar a normalização, validar colisões:

```sql
-- NÃO EXECUTAR COM PLACEHOLDERS.

SELECT
  upper(regexp_replace(
    btrim(__REFERENCE_VALUE_COLUMN__::text),
    '[^[:alnum:]]',
    '',
    'g'
  )) AS normalized,
  count(DISTINCT __REFERENCE_VALUE_COLUMN__::text) AS raw_variants,
  array_agg(DISTINCT __REFERENCE_VALUE_COLUMN__::text)
    FILTER (WHERE __REFERENCE_VALUE_COLUMN__ IS NOT NULL) AS examples
FROM public.cross_references
GROUP BY 1
HAVING count(DISTINCT __REFERENCE_VALUE_COLUMN__::text) > 1
ORDER BY raw_variants DESC
LIMIT 100;
```

Se pontuação diferenciar códigos válidos, ajustar a regra antes de criar o índice.

### 8.6 Acompanhar criação de índices

Em outra sessão:

```sql
SELECT
  pid,
  datname,
  relid::regclass AS table_name,
  index_relid::regclass AS index_name,
  phase,
  lockers_total,
  lockers_done,
  blocks_total,
  blocks_done,
  tuples_total,
  tuples_done
FROM pg_stat_progress_create_index;
```

Verificar índices inválidos após qualquer interrupção:

```sql
SELECT
  n.nspname AS schema_name,
  c.relname AS index_name,
  i.indisvalid,
  i.indisready
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (NOT i.indisvalid OR NOT i.indisready);
```

Se um índice `CONCURRENTLY` ficar inválido, `IF NOT EXISTS` não o corrigirá. Remover apenas o índice inválido identificado e criá-lo novamente:

```sql
-- Substituir pelo nome exato retornado na consulta anterior.
DROP INDEX CONCURRENTLY IF EXISTS public.__INVALID_INDEX_NAME__;

-- Reexecutar depois o CREATE INDEX CONCURRENTLY correspondente.
```

---

## 9. Segurança obrigatória do PostgREST

### 9.1 Problema atual

A documentação original contém uma senha de banco em texto claro e configura o PostgREST para conectar usando o usuário `postgres`.

Isso deve ser corrigido:

- rotacionar imediatamente a senha exposta;
- não reutilizar essa senha;
- remover a senha de documentos, histórico de comandos, variáveis copiadas e repositórios;
- usar um login dedicado e sem privilégios administrativos para o PostgREST.

Este documento não reproduz a credencial encontrada.

### 9.2 Criar login autenticador

No PostgreSQL:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'postgrest_authenticator'
  ) THEN
    CREATE ROLE postgrest_authenticator;
  END IF;
END
$$;

ALTER ROLE postgrest_authenticator
  LOGIN
  NOINHERIT
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;

ALTER ROLE web_anon
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;

GRANT web_anon TO postgrest_authenticator;
```

Definir senha forte de forma interativa:

```bash
docker exec -it tecdoc_postgres \
  psql -U postgres -d tecdoc_catalog \
  -c '\password postgrest_authenticator'
```

Não colocar a senha no arquivo `.md`, no repositório ou diretamente no histórico do shell.

### 9.3 Garantir privilégio mínimo

```sql
GRANT USAGE ON SCHEMA public TO web_anon;

REVOKE ALL ON TABLE
  public.articles,
  public.article_vehicles,
  public.vehicles,
  public.models,
  public.article_media,
  public.brands,
  public.manufacturers,
  public.cross_references,
  public.engines
FROM web_anon;

GRANT SELECT ON public.view_busca_catalogo TO web_anon;

-- Conceder somente depois que cada view for criada:
-- GRANT SELECT ON public.view_tecdoc_artigos_v2 TO web_anon;
-- GRANT SELECT ON public.view_tecdoc_aplicacoes_v2 TO web_anon;
-- GRANT SELECT ON public.view_tecdoc_imagens_v2 TO web_anon;
-- GRANT SELECT ON public.view_tecdoc_referencias_v2 TO web_anon;
```

Auditar o resultado:

```sql
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'web_anon'
ORDER BY table_schema, table_name, privilege_type;
```

O resultado não deve conter `SELECT` nas tabelas-base.

### 9.4 Timeouts do banco

Executar esta etapa somente depois dos índices da seção 8 e dos testes de plano/latência da seção 12. O PostgREST conecta como `postgrest_authenticator` e depois assume `web_anon`; portanto, configurar o login autenticador também é obrigatório.

```sql
ALTER ROLE postgrest_authenticator
  IN DATABASE tecdoc_catalog
  SET statement_timeout = '5s';

ALTER ROLE postgrest_authenticator
  IN DATABASE tecdoc_catalog
  SET idle_in_transaction_session_timeout = '10s';

ALTER ROLE web_anon
  IN DATABASE tecdoc_catalog
  SET statement_timeout = '5s';

ALTER ROLE web_anon
  IN DATABASE tecdoc_catalog
  SET idle_in_transaction_session_timeout = '10s';
```

O timeout pode ser aumentado para uma operação administrativa específica com `SET LOCAL`, mas não deve ser removido da role pública.

Depois de reiniciar o PostgREST, validar no log e por uma consulta real que requisições acima do limite são canceladas. Não assumir que `ALTER ROLE web_anon` sozinho será aplicado após `SET ROLE`.

### 9.5 Configuração recomendada do PostgREST

No Easypanel, alterar as variáveis do serviço PostgREST:

```text
PGRST_DB_URI=postgres://postgrest_authenticator:<SENHA_URL_ENCODED>@tecdoc_postgres:5432/tecdoc_catalog
PGRST_DB_SCHEMAS=public
PGRST_DB_ANON_ROLE=web_anon
PGRST_DB_MAX_ROWS=100
```

Observações:

- `<SENHA_URL_ENCODED>` precisa estar percent-encoded no URI;
- preferir secret do Easypanel, não variável versionada;
- `PGRST_DB_MAX_ROWS=100` limita a quantidade retornada mesmo se um cliente omitir `limit`;
- o aplicativo atualmente utiliza no máximo dezenas de linhas por chamada;
- artigos com mais de 100 aplicações, imagens ou referências exigem paginação por `limit` + `offset`;
- após alterar, recriar/reiniciar somente o container PostgREST.

Se o deploy for feito manualmente por Docker:

> Se o serviço for gerenciado pelo Easypanel, não usar `docker stop/rm/run`: alterar as variáveis e fazer redeploy pelo próprio Easypanel. O exemplo abaixo só vale para uma instalação Docker realmente gerenciada à mão. Antes, confirmar `docker inspect postgrest`, o nome da rede e a imagem/digest atualmente aprovados.

```bash
CURRENT_IMAGE=$(docker inspect postgrest \
  --format '{{.Config.Image}}')

docker stop postgrest
docker rm postgrest

docker run -d \
  --name postgrest \
  --network tecdoc_default \
  -p 3005:3000 \
  --env-file /CAMINHO/SEGURO/postgrest.env \
  --restart unless-stopped \
  "$CURRENT_IMAGE"
```

Arquivo protegido `/CAMINHO/SEGURO/postgrest.env`:

```text
PGRST_DB_URI=postgres://postgrest_authenticator:<SENHA_URL_ENCODED>@tecdoc_postgres:5432/tecdoc_catalog
PGRST_DB_SCHEMAS=public
PGRST_DB_ANON_ROLE=web_anon
PGRST_DB_MAX_ROWS=100
```

Permissões:

```bash
chmod 600 /CAMINHO/SEGURO/postgrest.env
```

### 9.6 HTTPS, firewall e limitação

Conforme o roadmap do documento original:

1. colocar a API atrás do Traefik/Easypanel com HTTPS;
2. disponibilizar domínio próprio, por exemplo `https://tecdoc-api.seudominio.com`;
3. exigir API key ou JWT;
4. aplicar rate limit por IP/chave;
5. bloquear a porta pública `3005` no firewall após validar o proxy;
6. permitir acesso direto à porta apenas pela rede Docker ou IPs administrativos.

Não bloquear a porta antes de o endpoint HTTPS estar validado pelo aplicativo.

---

## 10. Recarregar o schema do PostgREST

Depois de criar ou substituir views:

```sql
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
```

Ou pelo host:

```bash
docker exec -i tecdoc_postgres \
  psql -U postgres -d tecdoc_catalog <<'SQL'
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
SQL
```

Se os novos endpoints não aparecerem após alguns segundos:

```bash
docker restart postgrest
docker logs --since=5m postgrest
```

---

## 11. Contrato PostgREST esperado

Definir:

```bash
API='http://127.0.0.1:3005'
```

Executar os testes inicialmente dentro da VPS.

### 11.1 Compatibilidade legada

```bash
curl --fail-with-body -sS \
  "$API/view_busca_catalogo?select=article_id,description,vehicle_id,vehicle_desc,model_name,image_url&limit=1&offset=0"
```

Esperado: HTTP 200 e array JSON.

### 11.2 Artigos

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_artigos_v2?select=article_id,description,image_url&article_id=eq.1&limit=10"
```

Busca textual:

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_artigos_v2?select=article_id,description,image_url&description=ilike.*Oil%20Filter*&order=article_id.asc&limit=20&offset=0"
```

Após código/fabricante:

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_artigos_v2?select=article_id,article_code,description,manufacturer_name,image_url&article_code_normalized=eq.OC90&limit=20"
```

### 11.3 Aplicações

Por artigo:

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_aplicacoes_v2?select=*&article_id=eq.1&order=vehicle_id.asc&limit=100"
```

Por modelo:

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_aplicacoes_v2?select=article_id,vehicle_id,model_name,vehicle_description&model_name=ilike.*Gol*&order=article_id.asc&limit=100"
```

Após enriquecer:

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_aplicacoes_v2?select=article_id,vehicle_id,model_name,vehicle_description,engine_name,production_from,production_to,fuel_type&article_id=eq.1&limit=100"
```

### 11.4 Referências/OEM

Por artigo:

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_referencias_v2?select=*&article_id=eq.1&order=is_oem.desc,reference_value.asc&limit=100"
```

Busca exata normalizada:

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_referencias_v2?select=article_id,reference_value,reference_type,manufacturer_name,is_oem&reference_normalized=eq.OC90&limit=100"
```

A aplicação então busca os artigos retornados:

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_artigos_v2?select=*&article_id=in.(1,2,3)&limit=100"
```

### 11.5 Imagens

```bash
curl --fail-with-body -sS \
  "$API/view_tecdoc_imagens_v2?select=image_id,article_id,image_url&article_id=eq.1&order=image_id.asc&limit=100"
```

### 11.6 Tabelas-base devem continuar bloqueadas

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  "$API/articles?limit=1"

curl -sS -o /dev/null -w '%{http_code}\n' \
  "$API/cross_references?limit=1"
```

Esperado: `401`, `403` ou erro de permissão. Nunca `200`.

### 11.7 Proteção de máximo de linhas

Testar deliberadamente sem `limit` somente depois de configurar `PGRST_DB_MAX_ROWS`, em ambiente controlado:

```bash
curl -sS -D /tmp/headers.txt -o /tmp/body.json \
  "$API/view_tecdoc_artigos_v2?select=article_id"

python3 - <<'PY'
import json
with open('/tmp/body.json') as f:
    data = json.load(f)
print('rows:', len(data))
assert len(data) <= 100
PY
```

Não repetir esse teste na view legada antes de confirmar o limite global.

---

## 12. Validação SQL e performance

### 12.1 Cardinalidade

As contagens exatas abaixo são administrativas e podem ser caras. Executá-las em janela controlada, conectado como administrador, depois de verificar I/O e locks. Não as expor como `count=exact` no PostgREST.

```sql
SET statement_timeout = '0';

SELECT count(*) FROM public.articles;
SELECT count(*) FROM public.view_tecdoc_artigos_v2;

RESET statement_timeout;
```

Os dois totais devem ser iguais.

Verificar duplicidade:

```sql
SELECT article_id, count(*)
FROM public.view_tecdoc_artigos_v2
GROUP BY article_id
HAVING count(*) > 1
LIMIT 10;
```

Esperado: zero linhas.

Aplicações:

```sql
SELECT article_id, vehicle_id, count(*)
FROM public.view_tecdoc_aplicacoes_v2
GROUP BY article_id, vehicle_id
HAVING count(*) > 1
LIMIT 10;
```

Se houver duplicidade na origem, decidir se deve ser removida na importação ou com `SELECT DISTINCT`. Preferir corrigir a origem quando possível.

Referências:

```sql
SELECT
  article_id,
  reference_normalized,
  manufacturer_id,
  reference_type,
  count(*)
FROM public.view_tecdoc_referencias_v2
GROUP BY
  article_id,
  reference_normalized,
  manufacturer_id,
  reference_type
HAVING count(*) > 1
LIMIT 100;
```

### 12.2 Integridade referencial lógica

```sql
SELECT count(*) AS orphan_applications
FROM public.view_tecdoc_aplicacoes_v2 app
LEFT JOIN public.articles a
  ON a.id = app.article_id
WHERE a.id IS NULL;
```

```sql
SELECT count(*) AS orphan_references
FROM public.view_tecdoc_referencias_v2 ref
LEFT JOIN public.articles a
  ON a.id = ref.article_id
WHERE a.id IS NULL;
```

Esperado: zero.

### 12.3 Planos de execução

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT article_id, description, image_url
FROM public.view_tecdoc_artigos_v2
WHERE description ILIKE '%Oil Filter%'
ORDER BY article_id
LIMIT 20;
```

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT article_id, vehicle_id, model_name, vehicle_description
FROM public.view_tecdoc_aplicacoes_v2
WHERE model_name ILIKE '%Gol%'
ORDER BY article_id
LIMIT 100;
```

Após a view de referência:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT article_id, reference_value, reference_type, is_oem
FROM public.view_tecdoc_referencias_v2
WHERE reference_normalized = 'OC90'
LIMIT 100;
```

Critérios:

- buscas exatas normalizadas devem usar índice;
- `ILIKE '%termo%'` deve considerar o índice trigram;
- detalhes por `article_id` devem responder rapidamente;
- evitar `Seq Scan` sobre tabelas enormes quando há filtro seletivo;
- medir com cache frio e cache quente;
- confirmar que nenhuma chamada ultrapassa o `statement_timeout`.

### 12.4 Estatísticas

Após criar os índices:

```sql
ANALYZE public.articles;
ANALYZE public.article_vehicles;
ANALYZE public.vehicles;
ANALYZE public.models;
ANALYZE public.article_media;

-- Depois de resolver o schema:
ANALYZE public.cross_references;
```

---

## 13. Sequência de deploy recomendada

Esta é a ordem oficial. Não seguir as seções 4–12 linearmente.

### Fase 1 — Descoberta

- [ ] snapshot/backup criado;
- [ ] colunas exportadas;
- [ ] FKs exportadas;
- [ ] índices exportados;
- [ ] amostras de referências e OEM analisadas;
- [ ] regra de normalização aprovada;
- [ ] campos de fabricante/marca confirmados;
- [ ] campos de motor/ano confirmados.

### Fase 2 — Credenciais e privilégio mínimo

- [ ] senha exposta rotacionada;
- [ ] `postgrest_authenticator` criado;
- [ ] PostgREST deixou de usar superusuário;
- [ ] tabelas-base bloqueadas para `web_anon`;
- [ ] `PGRST_DB_MAX_ROWS` configurado;
- [ ] endpoint legado validado.

### Fase 3 — Endpoints confirmados

- [ ] `view_tecdoc_artigos_v2`;
- [ ] `view_tecdoc_aplicacoes_v2`;
- [ ] `view_tecdoc_imagens_v2`;
- [ ] grants aplicados;
- [ ] schema cache recarregado;
- [ ] curls retornando HTTP 200.

### Fase 4 — Índices

- [ ] `pg_trgm`;
- [ ] descrição de artigo;
- [ ] descrição de veículo;
- [ ] nome de modelo;
- [ ] associação artigo/veículo;
- [ ] primeira imagem JPEG;
- [ ] `ANALYZE`;
- [ ] planos verificados;
- [ ] latência do endpoint legado medida;
- [ ] `statement_timeout` configurado no autenticador e em `web_anon`;
- [ ] endpoint legado retestado com o timeout ativo.

### Fase 5 — OEM/referências e enriquecimento

- [ ] placeholders resolvidos;
- [ ] `view_tecdoc_referencias_v2`;
- [ ] códigos/fabricantes adicionados aos artigos;
- [ ] motor/ano adicionados às aplicações;
- [ ] índices de códigos/referências;
- [ ] duplicidades analisadas;
- [ ] endpoints validados com exemplos reais.

### Fase 6 — Exposição pública

- [ ] HTTPS;
- [ ] API key/JWT;
- [ ] rate limit;
- [ ] logs;
- [ ] porta 3005 bloqueada externamente;
- [ ] URL final entregue ao frontend.

Não conceder acesso externo às views de OEM/referências antes de HTTPS, autenticação e rate limit estarem ativos. Se a proteção de borda ainda não estiver pronta, validar essas views apenas dentro da VPS/rede Docker.

---

## 14. Critérios de aceite para entrega ao frontend

Os critérios abaixo representam a entrega completa após a Fase 5. A conclusão da Fase 3 é apenas uma entrega técnica intermediária e ainda não contém código real, OEM, fabricante ou motor.

O backend só deve declarar a entrega concluída quando:

1. `view_busca_catalogo` continua retornando HTTP 200;
2. um artigo aparece uma única vez em `view_tecdoc_artigos_v2`;
3. aplicações podem ser consultadas por `article_id` e `vehicle_id`;
4. referência OEM real retorna o artigo correto;
5. referência concorrente real retorna o artigo correto;
6. fabricante/marca aparece com significado validado;
7. código principal não é um ID sintético;
8. busca normalizada ignora apenas os caracteres aprovados;
9. consultas de detalhe respeitam o timeout;
10. chamadas anônimas às tabelas-base são negadas;
11. o PostgREST não usa superusuário;
12. nenhuma senha está presente no documento ou repositório;
13. chamadas sem `limit` ficam limitadas por `PGRST_DB_MAX_ROWS`;
14. índices estão válidos;
15. o backend forneceu exemplos de payload reais para todos os endpoints.

Payload mínimo esperado de artigo:

```json
{
  "article_id": 123,
  "article_code": "CODIGO-REAL",
  "description": "Oil Filter",
  "manufacturer_id": 10,
  "manufacturer_name": "Fabricante",
  "image_url": "https://..."
}
```

Payload mínimo esperado de aplicação:

```json
{
  "article_id": 123,
  "vehicle_id": 456,
  "model_id": 20,
  "model_name": "Gol",
  "vehicle_description": "1.6",
  "engine_id": 30,
  "engine_name": "EA111",
  "production_from": "2008-01-01",
  "production_to": "2012-12-31",
  "fuel_type": "Flex"
}
```

Payload mínimo esperado de referência:

```json
{
  "reference_id": "oem:789",
  "article_id": 123,
  "reference_value": "030115561AB",
  "reference_normalized": "030115561AB",
  "reference_type": "OEM",
  "manufacturer_id": 40,
  "manufacturer_name": "Volkswagen",
  "is_oem": true
}
```

Os exemplos acima representam o contrato desejado; nomes/valores dependem do schema real.

---

## 15. Rollback

As novas views podem ser removidas sem tocar no endpoint legado:

```sql
BEGIN;

DROP VIEW IF EXISTS public.view_tecdoc_referencias_v2;
DROP VIEW IF EXISTS public.view_tecdoc_codigos_v2;
DROP VIEW IF EXISTS public.view_tecdoc_imagens_v2;
DROP VIEW IF EXISTS public.view_tecdoc_aplicacoes_v2;
DROP VIEW IF EXISTS public.view_tecdoc_artigos_v2;

GRANT SELECT ON public.view_busca_catalogo TO web_anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
```

Remover índices somente se comprovadamente causarem problema:

```sql
DROP INDEX CONCURRENTLY IF EXISTS
  public.articles_description_trgm_idx;

DROP INDEX CONCURRENTLY IF EXISTS
  public.vehicles_description_trgm_idx;

DROP INDEX CONCURRENTLY IF EXISTS
  public.models_name_trgm_idx;

DROP INDEX CONCURRENTLY IF EXISTS
  public.article_vehicles_vehicle_article_idx;

DROP INDEX CONCURRENTLY IF EXISTS
  public.article_media_jpeg_article_id_id_idx;
```

Não restaurar grants amplos. Restaurar somente os privilégios registrados no backup `grants-before.txt`.

Para reverter timeouts:

```sql
ALTER ROLE postgrest_authenticator
  IN DATABASE tecdoc_catalog
  RESET statement_timeout;

ALTER ROLE postgrest_authenticator
  IN DATABASE tecdoc_catalog
  RESET idle_in_transaction_session_timeout;

ALTER ROLE web_anon
  IN DATABASE tecdoc_catalog
  RESET statement_timeout;

ALTER ROLE web_anon
  IN DATABASE tecdoc_catalog
  RESET idle_in_transaction_session_timeout;
```

Restaurar a configuração do PostgREST a partir de `postgrest-inspect-before.json` ou do histórico de revisão do Easypanel, mantendo o login dedicado. Se `PGRST_DB_MAX_ROWS=100` impedir um fluxo previamente validado, ajustar para um limite explícito maior; não remover o limite.

Se o índice normal `(article_id, vehicle_id)` tiver sido removido após a criação do índice único e o rollback remover o único, recriar o índice normal:

```sql
DROP INDEX CONCURRENTLY IF EXISTS
  public.article_vehicles_article_vehicle_uidx;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  article_vehicles_article_vehicle_idx
ON public.article_vehicles (article_id, vehicle_id);
```

Após qualquer rollback de firewall/Traefik, restaurar somente a regra registrada no snapshot de infraestrutura. Manter a porta `3005` restrita sempre que o proxy HTTPS estiver saudável.

Não voltar a configurar o PostgREST com `postgres`.

---

## 16. Informações que o backend deve devolver

Após a implantação, entregar ao frontend:

```text
URL base HTTPS:

Autenticação:
  header:
  formato:

Endpoint de artigos:
Endpoint de aplicações:
Endpoint de referências:
Endpoint de imagens:

Limite máximo por resposta:
Timeout:
Rate limit:

Campos finais de artigo:
Campos finais de aplicação:
Campos finais de referência:

Valores possíveis de reference_type:
Regra que identifica OEM:
Regra de normalização:

Exemplo real — busca por descrição:
Exemplo real — busca por modelo:
Exemplo real — busca por código:
Exemplo real — busca por OEM:
Exemplo real — detalhe por article_id:

Data/hora do deploy:
Responsável:
Commit/migration aplicada:
Plano de rollback testado:
```

---

## 17. Observações para integração no Catálogo Industrial

O aplicativo atualmente:

- usa `article_id` como identidade externa;
- cria o código temporário `TecDoc-{article_id}`;
- consulta `view_busca_catalogo`;
- agrupa aplicações duplicadas por `article_id`;
- mostra descrição, imagem e contexto veicular;
- aplica timeout de 5 segundos;
- limita as buscas;
- traduz termos comuns PT → EN.

Com a API v2, o frontend poderá:

1. substituir `TecDoc-{article_id}` pelo código real;
2. buscar por OEM/referência normalizada;
3. exibir fabricante/marca;
4. mostrar aplicações tipadas;
5. filtrar por `vehicle_id`;
6. cruzar produtos locais com TecDoc por OEM;
7. carregar referências e aplicações sob demanda no detalhe;
8. preservar a busca federada atual durante a transição.

Não desligar a view legada antes de uma versão do aplicativo consumir e validar todos os endpoints v2.
