# Modelo de Dados — Pessoas, Entitlements e Tokens

Base do ERP 2.0. Segue o padrão de RLS já existente em [`sql/schema_tenant.sql`](../../sql/schema_tenant.sql) (helpers `private.*`, RLS por tenant). Migrations em [`sql/migrations/`](../../sql/migrations/): 007 (pessoas), 008 (entitlements), 009 (tokens).

## 1. Hierarquia multi-tenant

```
organizacao (tenant)   → Piroli Autopeças (revenda cliente do produto)
  unidade              → Eldorado, Mundo Novo, Dourados (empresas 0001, 0003...)
    pessoa             → identidade PF/PJ (cliente, fornecedor, vendedor, oficina...)
```

Hoje o app tem `lojas` + `membros_loja`. Estratégia de compat: `organizacoes` referencia/agrupa `lojas` existentes; no v1 uma `loja` pertence a uma `organizacao`. `unidades` detalha as empresas do SS Plus. Entitlements ficam em `loja_modulos` (por loja, o nível que o super admin gerencia).

> Nota de compat: no v1, `organizacao` 1:N `lojas`, e `loja` pode ter N `unidades`. Se depois a granularidade de entitlement subir para organização, `loja_modulos` ganha um espelho por organização sem quebrar o existente.

## 2. Entidades — Pessoas (migration 007)

### pessoas
Identidade central. Substitui gradualmente `clientes`.

| Campo | Tipo | Notas |
|---|---|---|
| id | bigint PK | |
| organizacao_id | bigint FK | tenant |
| tipo_pessoa | varchar(2) | 'PF' \| 'PJ' |
| nome | varchar(255) | razão social ou nome |
| nome_fantasia | varchar(255) | |
| documento_cifrado | bytea | CPF/CNPJ cifrado (pgcrypto/pgsodium) |
| documento_bidx | bytea | **blind index** (HMAC) para busca por igualdade |
| documento_mascara | varchar(20) | últimos dígitos p/ exibição (ex.: ***.***.678-90) |
| foto_url | text | bucket privado `pessoas` |
| situacao | varchar(10) | 'ativo' \| 'inativo' |
| criado_em / atualizado_em | timestamptz | |

Sensível cifrado: `documento_cifrado`. Buscável: `documento_bidx`. Exibível sem descriptografar: `documento_mascara`.

### pessoa_papeis
Papel comercial (≠ permissão de sistema). N por pessoa.

| Campo | Tipo | Notas |
|---|---|---|
| id | bigint PK | |
| pessoa_id | bigint FK | |
| papel | varchar(30) | cliente\|fornecedor\|vendedor\|funcionario\|entregador\|oficina\|mecanico\|custom |
| papel_custom | varchar(60) | quando papel='custom' (botão "+") |
| UNIQUE | (pessoa_id, papel, papel_custom) | |

### pessoa_contatos
N contatos com destino de fechamento.

| Campo | Tipo | Notas |
|---|---|---|
| id, pessoa_id | | |
| canal | varchar(15) | email\|whatsapp\|sms |
| valor_cifrado | bytea | contato cifrado |
| valor_bidx | bytea | blind index (busca por telefone/email) |
| rotulo | varchar(60) | "secretária", "contador"... |
| recebe_fechamento | boolean | resolve o "mandar pra três" |
| recebe_cobranca | boolean | |

### pessoa_enderecos
N endereços (CEP, logradouro, número, bairro, cidade, uf, complemento, principal boolean).

### pessoa_veiculos
Veículos relacionados **com exclusão** (placa, veiculo, marca, ano, chassi_cifrado). Corrige a dor do SS Plus.

### grupos_comerciais
Configurável por organização (à vista, mensal, credital, expresso...). `pessoas` referencia `grupo_comercial_id`.

### pessoa_regras_unidade
Regras por unidade (o "%Des/Acréscimo por Empresa" + formas de pagamento + vendedores + entrega).

| Campo | Tipo |
|---|---|
| pessoa_id, unidade_id | FK |
| desconto_percentual | numeric(5,2) |
| formas_pagamento | text[] |
| vendedores_autorizados | bigint[] (pessoa_id de vendedores) |
| modo_entrega | varchar(20) |

### auditoria
Mínima: (id, organizacao_id, tabela, registro_id, acao, ator_user_id, diff jsonb, criado_em). Resolve "quem alterou".

## 3. Entitlements (migration 008)

### modulos
Catálogo dos menus vendáveis: pessoas, busca, orcamento, catalogos, agregados, historico, financeiro, fiscal, ia, marketing. (id, chave, nome, descricao, ativo_global).

### loja_modulos
O que cada loja tem ligado. (loja_id, modulo_chave, ativo, valido_ate, criado_por). PK (loja_id, modulo_chave).

### super_admins
Flag fora do tenant. (user_id PK). Só super admin/service_role escreve em `loja_modulos`/`modulos`.

Helper novo: `private.loja_tem_modulo(p_loja_id, p_modulo)` e `private.usuario_e_super_admin()`.

## 4. Tokens de IA (migration 009)

### token_ledger (append-only)
Nunca update; saldo = soma. (id, loja_id, tipo 'credito'|'debito', tokens bigint, origem 'recarga'|'uso_ia', referencia_id, descricao, criado_em). Saldo via view `token_saldo`.

### recargas
Ganchos genéricos de gateway (gateway concreto em P2). (id, loja_id, valor_centavos, tokens, gateway varchar, gateway_ref, status 'pendente'|'pago'|'falhou', criado_em, pago_em). Webhook credita `token_ledger` ao virar 'pago'.

### ia_uso
Log de consumo por chamada (loja_id, user_id, modelo, prompt_tokens, completion_tokens, criado_em) → gera débito no ledger.

## 5. Segurança embutida no schema

- **RLS** em todas as tabelas, via `organizacao_id`/`loja_id` + helpers `private.*`.
- **Least privilege**: `authenticated` só enxerga seu tenant; escrita de entitlements/modulos só super admin.
- **Cripto seletiva**: `*_cifrado` (bytea) + `*_bidx` (HMAC) + `*_mascara` (exibição). Chaves em secrets do Coolify, funções de cifra em schema `private`.
- **Anti mass assignment**: `GRANT` por coluna; Server Actions com whitelist; nunca insert de objeto cru.
- **Constraints**: CHECK em enums (tipo_pessoa, canal, papel, status), UNIQUE nos naturais.
- **Trim de resposta**: views/DTO expõem `*_mascara`, nunca `*_cifrado`.

## 6. Compatibilidade com o que existe

- `clientes` permanece durante a transição; view `clientes_compat` ou migração de dados para `pessoas` (papel cliente) mantém [`orcamentos`](../../sql/schema_tenant.sql) e a busca funcionando.
- `orcamentos.cliente_id` passa a poder referenciar `pessoas` (FK nova, nullable durante transição).
