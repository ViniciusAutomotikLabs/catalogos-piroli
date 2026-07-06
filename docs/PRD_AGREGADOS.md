# PRD — Agregados de Montagem (regras globais)

**Produto:** Catálogo Industrial Piroli  
**Feature:** Agregados na venda de balcão  
**Versão:** 1.0  
**Data:** 05/07/2026  
**Status:** Aprovado para implementação  
**Escopo de regra:** **Global** (válido para todas as lojas; não há kit por revenda no MVP)

**Documentos relacionados:** `docs/UX_MELHORIAS_BALCAO.md`, `docs/HANDOFF_BACKEND_MELHORIAS.md` (BE-07), `docs/ROADMAP_MVP.md`, `PROJETO_HISTORICO.md`

---

## 1. Executive Summary

Quando o vendedor encontra uma peça principal (ex.: amortecedor, kit coroa/pião), o sistema deve **sugerir automaticamente os itens complementares da montagem** — batentes, coifas, travas, rolamentos, graxa etc. — para evitar venda incompleta, retrabalho e volta do cliente.

**Agregado** = peça **diferente** que compõe a montagem junto com a principal. Não é substituto (equivalente) nem referência cruzada.

**Valor:** aumentar ticket médio com recomendação operacional confiável, reduzir erro de montagem e aproximar o app do SS Plus na densidade informacional que o balcão valoriza.

**MVP:** cadastro global manual dos primeiros kits + exibição na **busca**, **detalhe** e **orçamento**, com ação em lote “adicionar agregados sugeridos”.

---

## 2. Problem Statement

### Dor atual

| Quem | Dor | Impacto |
|------|-----|---------|
| Vendedor de balcão | Precisa lembrar de cabeça o que mais levar na montagem | Cliente volta faltando batente/coifa/parafuso |
| Cliente (oficina) | Recebe só a peça principal | Parada do veículo, reclamação, perda de confiança |
| Operação | Conhecimento fica na cabeça dos vendedores seniores | Curva de aprendizado alta; inconsistência entre balcões |
| Produto (app) | Busca mostra só o item pesquisado | Perde oportunidade de upsell operacional legítimo |

### Cenários reais

1. **Amortecedor** → batente, coifa, bucha, parafuso (quando aplicável).
2. **Kit coroa e pião** → travas, rolamentos, graxa, retentor.
3. **Pastilha de freio** → sensor de desgaste, graxa, parafuso.

Hoje o vendedor consulta memória, ERP legado ou pergunta ao colega. O app não apoia essa decisão no momento da venda.

---

## 3. Goals & Metrics

### Objetivos (SMART)

| ID | Objetivo | Meta MVP (90 dias) |
|----|---------|-------------------|
| G1 | Exibir agregados no fluxo de busca/detalhe | 100% dos produtos com relação cadastrada |
| G2 | Permitir adicionar agregados ao orçamento em 1 clique | ≤ 2 cliques a partir da busca |
| G3 | Cobrir casos críticos do balcão com seed manual | ≥ 30 relações principais→agregados no go-live |
| G4 | Manter busca rápida (não degradar RPC atual) | p95 busca + agregados ≤ 500 ms |

### Prioridades

| Nível | Escopo |
|-------|--------|
| **P0** | Schema global, RPC listar agregados, UI busca + detalhe + orçamento, seed manual inicial |
| **P1** | Admin interno para CRUD de relações, ordenação obrigatório/opcional, observações |
| **P2** | Extração de agregados de catálogos/VPS, sugestão por IA, regras por aplicação/veículo |

### Métricas de sucesso

| Métrica | Como medir | Alvo |
|---------|------------|------|
| Taxa de adoção | % orçamentos com ≥1 agregado adicionado via sugestão | ≥ 15% em 60 dias |
| Cliques em “Adicionar agregados” | Evento na busca/detalhe | Baseline + crescimento mês a mês |
| Reclamação “faltou peça na montagem” | Feedback vendedor (qualitativo) | Redução percebida |
| Tempo até orçamento completo | Busca → itens no carrinho | Não aumentar vs. hoje |

---

## 4. Non-Goals (o que NÃO faremos no MVP)

- Regras de agregado **por loja** (todas as relações são globais).
- Preço/estoque dos agregados (MVP 2.0 / ERP).
- Substituição automática quando peça principal indisponível (**equivalentes** — feature separada).
- Motor de recomendação por ML sem curadoria humana.
- Agregados dinâmicos por veículo/ano no MVP (ex.: “só para Randon até 1984”) — fica para P2 com BE-06.
- Edição de agregados pelo vendedor comum no balcão (somente admin/catálogo no P1).

---

## 5. Conceitos e tipos de relação

Para alinhar com BE-07 e evitar confusão na UI:

| Tipo | Pergunta | Exemplo | MVP |
|------|----------|---------|-----|
| `agregado` | O que mais precisa na montagem? | Amortecedor → batente | **Sim (foco)** |
| `kit` | Itens vendidos sempre juntos como conjunto | Coroa+pião+travas+rolamentos | Sim (mesma UI) |
| `equivalente` | Qual código/marca substitui? | Marca A = Marca B | Não (schema pronto) |
| `similar` | Pode servir, validar | Aplicação parecida | Não (schema pronto) |
| `referencia_cruzada` | Outro código da mesma peça | Já existe em `referencias_cruzadas` | Fora do escopo |

**Regra global:** uma relação `produto_principal → produto_relacionado` vale para **todas as lojas** do sistema. Não há `loja_id` na tabela de relações no MVP.

---

## 6. User Personas

### P1 — Vendedor de balcão (primário)

- Atende cliente na frente ou no WhatsApp.
- Busca por código ou descrição (“amortecedor gol”).
- Precisa oferecer o kit completo sem perder tempo.
- **Sucesso:** vê agregados embaixo do resultado e adiciona tudo ao orçamento em segundos.

### P2 — Responsável de catálogo / produto (secundário)

- Mantém relações principais→agregados.
- Cria seeds iniciais e revisa qualidade.
- **Sucesso:** cadastra um kit em &lt; 3 minutos sem SQL.

### P3 — Dono da loja (terciário)

- Quer menos devolução e mais ticket médio.
- **Sucesso:** vendedores juniores vendem como seniores.

---

## 7. User Stories

| ID | Como… | Quero… | Para… |
|----|-------|--------|-------|
| US-01 | vendedor | ver agregados abaixo do produto na busca | oferecer montagem completa na hora |
| US-02 | vendedor | adicionar principal + agregados ao orçamento com um clique | não digitar item por item |
| US-03 | vendedor | distinguir obrigatório vs. recomendado | priorizar o que não pode faltar |
| US-04 | vendedor | ver agregados no detalhe do produto | confirmar antes de fechar venda |
| US-05 | admin catálogo | cadastrar relação global principal→agregados | padronizar conhecimento do balcão |
| US-06 | vendedor | não ver agregados irrelevantes | manter confiança na sugestão |

---

## 8. Functional Requirements

### P0 — Dados e API

#### FR-001 — Tabela de relações globais

**Descrição:** Persistir relações tipadas entre produtos no Supabase.

**Critérios de aceite:**
- Tabela `produto_relacoes` com: `produto_principal_id`, `produto_relacionado_id`, `tipo`, `obrigatorio`, `quantidade_sugerida`, `ordem`, `observacao`, `fonte`, `ativo`, `criado_em`, `atualizado_em`.
- `tipo` ∈ `agregado`, `kit`, `equivalente`, `similar` (MVP usa `agregado` e `kit`).
- `UNIQUE (produto_principal_id, produto_relacionado_id, tipo)`.
- `CHECK (produto_principal_id <> produto_relacionado_id)`.
- Sem coluna `loja_id` (regra global).
- RLS: leitura para `authenticated`; escrita apenas `service_role` ou papel admin futuro.

#### FR-002 — RPC `listar_agregados`

**Descrição:** Retornar agregados de um ou mais produtos para a UI.

**Assinatura sugerida:**
```sql
listar_agregados(p_produto_ids int[])
RETURNS TABLE (
  produto_principal_id int,
  produto_relacionado_id int,
  tipo text,
  obrigatorio boolean,
  quantidade_sugerida int,
  ordem int,
  observacao text,
  -- campos denormalizados para UI
  codigo_principal text,
  titulo_normalizado text,
  foto_url text,
  origem_catalogo text
)
```

**Critérios de aceite:**
- Retorna apenas `tipo IN ('agregado','kit')` e `ativo = true`.
- Ordenação: `obrigatorio DESC`, `ordem ASC`, `titulo_normalizado ASC`.
- Máximo 12 agregados por produto principal (configurável).
- p95 &lt; 100 ms para até 25 produtos (batch da página de busca).

#### FR-003 — Extensão opcional da RPC `buscar_produtos`

**Descrição:** Incluir contagem ou preview de agregados no retorno da busca (evitar N+1).

**Critérios de aceite:**
- Campo `agregados_count int` e/ou `agregados_preview text[]` (até 3 títulos) por linha.
- Se não implementado no P0, frontend chama `listar_agregados` em batch após a busca.

#### FR-004 — Seed manual inicial

**Descrição:** Script SQL ou seed documentado com ≥ 30 relações reais.

**Critérios de aceite:**
- Arquivo `sql/seeds/agregados_iniciais.sql` idempotente.
- Cobrir pelo menos: amortecedor, kit coroa/pião, pastilha, filtro, embreagem (exemplos do balcão).
- Cada relação com `fonte = 'manual'` e `obrigatorio` definido.

---

### P0 — Frontend (balcão)

#### FR-005 — Bloco “Leve também na montagem” na busca

**Arquivo:** `src/app/(app)/busca/page.tsx`

**Critérios de aceite:**
- Abaixo da linha do produto principal, se `agregados_count > 0`, exibir sublinha compacta.
- Mostrar até 3 chips (título ou código) + “+N” se houver mais.
- Badge visual: **Obrigatório** (destaque) vs **Recomendado**.
- Botão **+ Agregados** adiciona principal (se ainda não estiver) + todos os agregados sugeridos ao orçamento local.
- Não expandir altura da tabela além de ~1 linha extra por produto com agregados.
- Mobile: chips em wrap; ações permanecem visíveis.

**Wireframe (busca):**
```
┌─────────────────────────────────────────────────────────────┐
│ [foto] Amortecedor dianteiro Gol G5          [+ Orç] [WA]  │
│        Cód. 12345 · EIXOSUL                                 │
│        Montagem: Batente · Coifa · Bucha  [+ Agregados]    │
└─────────────────────────────────────────────────────────────┘
```

#### FR-006 — Seção Agregados no detalhe do produto

**Arquivo:** `src/app/(app)/produtos/[id]/page.tsx`

**Critérios de aceite:**
- Nova seção **“Itens da montagem”** acima de Aplicações.
- Lista com foto miniatura, código, título, quantidade sugerida, selo obrigatório/recomendado.
- Ação por item: **+ Orçamento** individual.
- Ação em lote: **Adicionar todos ao orçamento**.
- Estado vazio: não exibir seção (sem placeholder genérico).

#### FR-007 — Integração com orçamento

**Arquivos:** `src/lib/cart.ts`, `components/busca/adicionar-orcamento-button.tsx`

**Critérios de aceite:**
- Adicionar agregados não duplica itens já no carrinho (incrementa quantidade se mesma regra de negócio do carrinho atual).
- Respeitar `quantidade_sugerida` como default (mínimo 1).
- WhatsApp/orçamento listam itens adicionados com código `codigo_principal`.

#### FR-008 — Fallback sem agregados

**Critérios de aceite:**
- Produto sem relação cadastrada: UI idêntica à atual (zero regressão).
- Falha na RPC: busca continua funcionando; agregados simplesmente não aparecem + log servidor.

---

### P1 — Administração

#### FR-009 — Tela admin de relações (interna)

**Critérios de aceite:**
- Rota restrita (ex.: `/admin/agregados` ou integrada em `/catalogos`) para papel dono/admin.
- Buscar produto principal por código/descrição.
- Adicionar/remover agregados, definir ordem, obrigatório, quantidade, observação.
- Validar que principal ≠ relacionado e que não duplica relação.
- Listar relações existentes com filtro por tipo.

---

## 9. Modelo de dados (proposta)

```sql
-- sql/migrations/004_produto_relacoes.sql

CREATE TABLE public.produto_relacoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    produto_principal_id INT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    produto_relacionado_id INT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('agregado','kit','equivalente','similar')),
    obrigatorio BOOLEAN NOT NULL DEFAULT false,
    quantidade_sugerida INT NOT NULL DEFAULT 1 CHECK (quantidade_sugerida > 0),
    ordem INT NOT NULL DEFAULT 0,
    observacao TEXT,
    fonte TEXT NOT NULL DEFAULT 'manual' CHECK (fonte IN ('manual','catalogo','erp','importacao')),
    confianca TEXT DEFAULT 'alta' CHECK (confianca IN ('alta','media','revisar')),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (produto_principal_id, produto_relacionado_id, tipo),
    CHECK (produto_principal_id <> produto_relacionado_id)
);

CREATE INDEX idx_produto_relacoes_principal
    ON public.produto_relacoes (produto_principal_id)
    WHERE ativo = true AND tipo IN ('agregado','kit');
```

**Notas:**
- Relação é **direcional**: A → B não implica B → A.
- Para kits bidirecionais visuais, cadastrar explicitamente ou usar `tipo = 'kit'` com ordem definida.
- Futuro: tabela `produto_relacao_grupos` se precisar nomear kits (“Kit amortecedor Gol G5”).

---

## 10. Contrato API → Frontend

```typescript
type AgregadoItem = {
  produtoPrincipalId: number;
  produtoRelacionadoId: number;
  tipo: "agregado" | "kit";
  obrigatorio: boolean;
  quantidadeSugerida: number;
  ordem: number;
  observacao: string | null;
  codigoPrincipal: string;
  tituloNormalizado: string;
  fotoUrl: string | null;
  origemCatalogo: string;
};

type BuscaComAgregados = BuscaProdutoResultado & {
  agregadosCount?: number;
  agregadosPreview?: string[];
  agregados?: AgregadoItem[];
};
```

**Helper sugerido:** `src/lib/agregados.ts` — `listarAgregadosPorProdutos(ids: number[])`.

---

## 11. Seed inicial (exemplos para cadastro)

Cadastrar após identificar `produto_id` reais no banco:

| Principal (buscar por) | Agregados | Obrigatório |
|------------------------|-----------|-------------|
| Amortecedor dianteiro * | Batente, Coifa, Bucha | Batente: sim |
| Kit coroa e pião * | Trava, Rolamento, Graxa, Retentor | Trava, Rolamento: sim |
| Pastilha de freio * | Sensor desgaste, Graxa | Sensor: recomendado |
| Disco de freio * | Pastilha (se não principal), Graxa | — |
| Filtro de óleo * | Anel, Vedador | Anel: sim |
| Embreagem * | Rolamento embreagem, Garfo (se aplicável) | Rolamento: sim |

\* Substituir por IDs reais via script de descoberta:
```sql
SELECT id, codigo_principal, titulo_normalizado
FROM produtos
WHERE titulo_normalizado ILIKE '%amortecedor%'
LIMIT 20;
```

---

## 12. Implementation Phases

### Fase 1 — Fundação (P0 backend) — ~2–3 dias

| Task | Entregável |
|------|------------|
| Migration `004_produto_relacoes.sql` | Tabela + índices + RLS |
| RPC `listar_agregados` | Função + grant authenticated |
| Seed `agregados_iniciais.sql` | ≥ 30 relações |
| Types `supabase/types.ts` | Tipos atualizados |
| Testes SQL ou script smoke | 3 produtos com agregados retornando |

### Fase 2 — Balcão (P0 frontend) — ~2–3 dias

| Task | Entregável |
|------|------------|
| `src/lib/agregados.ts` | Cliente RPC + batch |
| Busca: sublinha + botão | `busca/page.tsx` |
| Detalhe: seção montagem | `produtos/[id]/page.tsx` |
| Carrinho: add em lote | `cart.ts` + botões |
| Testes manuais | Fluxo busca → orçamento → WhatsApp |

### Fase 3 — Operação (P1) — ~2 dias

| Task | Entregável |
|------|------------|
| Admin CRUD relações | Tela interna |
| Documentação operacional | Como cadastrar novo kit |
| Métricas básicas | Log de cliques (opcional Vercel Analytics event) |

### Fase 4 — Escala (P2, futuro)

- Importar agregados das VPS Postgres quando existirem.
- Filtrar agregados por `aplicacao_resumo` / BE-06.
- Tipos `equivalente` e `similar` na UI (BE-07 completo).

---

## 13. UX e copy (PT-BR)

| Elemento | Texto |
|----------|-------|
| Título seção busca | Montagem |
| Título seção detalhe | Itens da montagem |
| Selo obrigatório | Obrigatório na montagem |
| Selo opcional | Recomendado |
| Botão lote | + Agregados |
| Botão detalhe | Adicionar todos ao orçamento |
| Tooltip | Peças complementares para completar a montagem |

---

## 14. Risks & Mitigations

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Agregado errado para aplicação | Cliente leva peça que não serve | MVP global + curadoria manual; `confianca` e `observacao`; P2 por veículo |
| Poluição visual na busca | Tabela fica alta demais | Máx. 3 chips + expandir no detalhe |
| Performance (N+1) | Busca lenta | Batch RPC; preview na `buscar_produtos` |
| Duplicata no orçamento | Quantidade errada | Reusar lógica do carrinho; idempotência por `produto_id` |
| Produto agregado inexistente/inativo | Erro na UI | FK + filtro `ativo`; esconder relacionados sem estoque futuro |
| Confusão agregado vs equivalente | Vendeder peça errada | Tipos separados; copy clara; equivalentes em seção distinta (P2) |

---

## 15. Dependencies

| Dependência | Status |
|-------------|--------|
| `produtos` com `codigo_principal`, `titulo_normalizado` | ✅ |
| RPC `buscar_produtos` | ✅ |
| Orçamento / carrinho local | ✅ |
| Admin auth (papel dono) | 🟡 schema `membros_loja.papel` existe |
| BE-06 aplicações por veículo | ⬜ futuro |
| Estoque/preço agregados | ⬜ MVP 2.0 |

---

## 16. Acceptance checklist (go-live)

- [ ] Migration aplicada em produção
- [ ] ≥ 30 relações globais cadastradas e revisadas pelo time de balcão
- [ ] Busca exibe agregados para amortecedor (teste E2E)
- [ ] Detalhe lista agregados com fotos/códigos
- [ ] “+ Agregados” adiciona itens corretos ao orçamento
- [ ] Produto sem agregados: zero mudança visual
- [ ] `npm run build` e testes passando
- [ ] Documentação atualizada em `HANDOFF_BACKEND_MELHORIAS.md` e `UX_MELHORIAS_BALCAO.md`

---

## 17. Agentes recomendados para implementação

| Fase | Agente | Escopo |
|------|--------|--------|
| 1 | `database-architect` | Migration + RLS + índices |
| 1 | `backend-architect` | RPC `listar_agregados`, seed, types |
| 2 | `frontend-developer` | Busca, detalhe, carrinho |
| 3 | `frontend-developer` + `backend-architect` | Admin CRUD |
| QA | `test-automator` ou manual balcão | Fluxo venda completo |

**Orquestração sugerida:** uma story “Agregados P0” com backend primeiro, frontend em seguida, usando este PRD como fonte única.

---

## 18. Self-score (framework 100 pts)

| Critério | Pontos | Nota |
|----------|--------|------|
| AI / estrutura sequencial | 23/25 | Fases, FR numerados, non-goals |
| Core PRD | 24/25 | Problema, personas, métricas |
| Clareza implementação | 28/30 | SQL, RPC, wireframe, arquivos |
| Completude | 18/20 | Riscos, seeds, checklist |
| **Total** | **93/100** | Pronto para dev |

---

*PRD v1.0 — regras globais confirmadas pelo produto em 05/07/2026. Próximo passo: implementar Fase 1 (migration + RPC + seed).*
