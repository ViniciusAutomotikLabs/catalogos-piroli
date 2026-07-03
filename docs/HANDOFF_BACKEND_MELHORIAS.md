# Handoff Backend → Frontend — Melhorias Pós-UX Balcão

Documento de retorno do backend após implementação das melhorias estruturais.

**Data:** 03/07/2026  
**Status:** P0 + P1 (busca/orçamento) **entregues e aplicados no Supabase**  
**Documento base:** `docs/UX_MELHORIAS_BALCAO.md`  
**Histórico técnico:** `PROJETO_HISTORICO.md` §13

---

## 1. Resumo executivo

| ID | Item | Status |
|----|------|--------|
| BE-01 | Pipeline de normalização | ✅ |
| BE-02 | Correção de `codigo_produto_interno` suspeito | ✅ (com guarda de unique constraint) |
| BE-03 | Backfill idempotente | ✅ script + execução em massa no Supabase |
| BE-04 | Ranking por tipo de match | ✅ |
| BE-05 | RPC `buscar_produtos` | ✅ aplicada + frontend integrado |
| BE-06 | Aplicações estruturadas por veículo | ⬜ P2 |
| BE-07 | Equivalências/similares tipados | ⬜ P2 |
| BE-08 | Contrato estoque/preço | ⬜ P3 |
| BE-09 | Orçamento transacional | ✅ RPC `salvar_orcamento` + action integrada |

---

## 2. O que foi aplicado no Supabase

Migrations em `sql/migrations/` (aplicadas em 03/07/2026 no projeto `oxqojsmlbptmofmhyfea`):

| Arquivo | Conteúdo |
|---------|----------|
| `001_produto_normalizacao.sql` | Colunas estruturadas + índices trigram |
| `002_buscar_produtos.sql` | RPC de busca com ranking |
| `003_salvar_orcamento.sql` | RPC transacional de orçamento |

### Novos campos em `produtos`

| Campo | Tipo | Uso no frontend |
|-------|------|-----------------|
| `descricao_original` | `text` | Texto bruto preservado; bloco colapsável no detalhe |
| `titulo_normalizado` | `text` | Título da linha na busca/dashboard/histórico |
| `codigo_principal` | `text` | Código para orçamento, WhatsApp e destaque na busca |
| `codigos_extraidos` | `text[]` | Chips extras no detalhe |
| `medidas_extraidas` | `text[]` | Futuro: chips de medidas no detalhe |
| `aplicacao_resumo` | `text` | Seção Aplicações (quando extraível do texto) |
| `normalizacao_status` | `ok` \| `parcial` \| `revisar` | Auditoria interna; badge opcional no admin |
| `codigo_produto_interno_anterior` | `text` | Valor legado quando corrigido |
| `normalizado_em` | `timestamptz` | Controle do backfill |

**Campos legados preservados:** `descricao`, `codigo_produto_interno`, `numero_produto`.

---

## 3. Contratos para o frontend (prontos para consumo)

### 3.1 Exibição — helpers já criados

Use `src/lib/produto-campos.ts`:

```ts
import { tituloExibicao, codigoExibicao, descricaoOriginalExibicao, labelMatchTipo } from "@/lib/produto-campos";
```

| UI | Campo preferido | Fallback (automático no helper) |
|----|-----------------|--------------------------------|
| Título | `titulo_normalizado` | `parseDescricao(descricao).titulo` |
| Código | `codigo_principal` | `codigo_produto_interno` |
| Texto original | `descricao_original` | `descricao` |
| Badge match | `match_tipo` da RPC | heurística legada |

**Importante:** manter `descricao-parser.ts` como fallback até 100% dos produtos terem `normalizado_em` preenchido.

### 3.2 Busca — RPC `buscar_produtos`

```ts
const { data } = await supabase.rpc("buscar_produtos", {
  p_termo: "1386677",      // opcional
  p_catalogo: "eixosul",    // opcional
  p_com_foto: false,
  p_pagina: 1,
  p_limite: 25,
});
```

**Retorno por linha:**

| Campo | Exemplo | Uso |
|-------|---------|-----|
| `match_tipo` | `codigo_exato` | Badge na linha |
| `match_valor` | `1386677` | Tooltip / destaque |
| `score` | `1000` | Ordenação (já aplicada na RPC) |
| `referencias` | `["804062","478"]` | Chips (array, não join) |
| `fabricante` | `EIXOSUL` | Subtítulo |
| `total_count` | `42` | Paginação (repetido em cada linha) |

**Valores de `match_tipo`:**

| Valor | Label sugerido (`labelMatchTipo`) |
|-------|-----------------------------------|
| `codigo_exato` | Código exato |
| `referencia_exata` | Via referência |
| `codigo_normalizado` | Código (normalizado) |
| `referencia_normalizada` | Referência (normalizada) |
| `texto` | *(sem badge)* |

**Integração atual:** `src/lib/busca-produtos.ts` chama a RPC; `busca/page.tsx` já consome `match_tipo` e campos normalizados. Fallback automático se RPC indisponível.

**Ranking implementado (ordem de score):**

1. Código principal exato (1000)
2. Referência cruzada exata (900)
3. Código normalizado — remove `.`, `-`, `/`, espaços (800)
4. Referência normalizada (700)
5. Título normalizado (500)
6. Descrição/texto livre (300)

### 3.3 Orçamento — RPC `salvar_orcamento`

```ts
await supabase.rpc("salvar_orcamento", {
  p_loja_id: lojaId,
  p_cliente_id: clienteId ?? undefined,
  p_criado_por: userId,
  p_itens: [
    { produto_id: 123, quantidade: 1, preco_unitario: 0 },
    { descricao: "Item avulso", quantidade: 2, preco_unitario: 10.5 },
  ],
});
// Retorno: [{ orcamento_id, ok, erro }]
```

**Integração atual:** `src/lib/actions/orcamentos.ts` usa a RPC com fallback legado.

### 3.4 Detalhe do produto

`produtos/[id]/page.tsx` já atualizado para:
- `titulo_normalizado` / `codigo_principal`
- chips de `codigos_extraidos`
- `aplicacao_resumo` na seção Aplicações (quando preenchido)
- texto original de `descricao_original`

---

## 4. Tarefas pendentes para o frontend

### P0 — Aproveitar dados do backend

| ID | Tarefa | Critério de aceite | Arquivos |
|----|--------|-------------------|----------|
| FE-09 | Badge de match completo | Exibir todos os `match_tipo`; destacar `match_valor` no código quando `codigo_exato` ou `codigo_normalizado` | `busca/page.tsx` |
| FE-16 | Dashboard/histórico com campos normalizados | Usar `tituloExibicao` / `codigoExibicao` em `page.tsx` e `historico/page.tsx` (hoje ainda usam só parser) | `page.tsx`, `historico/page.tsx` |
| FE-17 | Chips de medidas no detalhe | Exibir `medidas_extraidas` quando existirem | `produtos/[id]/page.tsx` |
| FE-18 | Indicador `normalizacao_status` (opcional) | Ícone discreto `revisar` para equipe interna | detalhe ou admin |

### P1 — UX avançada (inalterado do doc UX)

| ID | Tarefa | Depende de |
|----|--------|------------|
| FE-13 | Drawer de produto (row click) | — |
| FE-01–06 | Polish visual header/dashboard/cores | — |
| FE-12 | Focus trap drawer + modais | — |

### P2 — Aguarda backend futuro

| Item | Backend |
|------|---------|
| Aplicações por veículo (tabela) | BE-06 |
| Equivalências tipadas | BE-07 |
| Estoque/preço por loja | BE-08 |

---

## 5. Backfill e qualidade dos dados

**Script:** `npm run backfill:normalizacao`  
**Requisitos:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

```bash
# Piloto
npm run backfill:normalizacao -- --limite=500

# Completo (idempotente — só pendentes)
npm run backfill:normalizacao

# Reprocessar tudo
npm run backfill:normalizacao -- --force
```

**Relatório emitido:** `processados`, `ok`, `parcial`, `revisar`, `codigos_corrigidos`, `erros`.

**Regra de correção de código:** quando o código extraído conflita com `UNIQUE (codigo_produto_interno, origem_catalogo)`, o script grava `codigo_principal` mas **não** altera `codigo_produto_interno` — o frontend deve preferir `codigo_principal`.

**Auditoria SQL útil:**

```sql
SELECT normalizacao_status, count(*) FROM produtos GROUP BY 1;
SELECT * FROM produtos WHERE normalizacao_status = 'revisar' LIMIT 50;
SELECT * FROM produtos WHERE codigo_produto_interno_anterior IS NOT NULL LIMIT 20;
```

---

## 6. Arquivos backend entregues

| Área | Arquivos |
|------|----------|
| Migrations | `sql/migrations/001_*.sql`, `002_*.sql`, `003_*.sql` |
| Normalizador | `src/lib/produto-normalizador.ts`, `produto-normalizador.test.ts` |
| Parser display (legado) | `src/lib/descricao-parser.ts` |
| Helpers UI | `src/lib/produto-campos.ts` |
| Cliente busca | `src/lib/busca-produtos.ts` |
| Backfill | `scripts/backfill-normalizacao.ts` |
| Busca (integrado) | `src/app/(app)/busca/page.tsx` |
| Detalhe (integrado) | `src/app/(app)/produtos/[id]/page.tsx` |
| Orçamento (integrado) | `src/lib/actions/orcamentos.ts` |
| Types | `src/lib/supabase/types.ts` |

---

## 7. Observações

- Não remover `descricao-parser.ts` até backfill 100% concluído.
- `codigo_principal` é a fonte de verdade para orçamento/WhatsApp na busca e detalhe.
- Produtos com múltiplos `COD:` no texto ficam `parcial` — UI deve mostrar chips de `codigos_extraidos`.
- Próximo incremento backend sugerido: BE-06 (tabela `produto_aplicacoes`) + hook na ingestão Python (`main2.py`).
