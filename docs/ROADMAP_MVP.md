# Roadmap MVP — Do catálogo ao marketplace

Guia passo a passo para evoluir o produto **sem tentar construir um Mercado Livre de uma vez**.

**Visão de longo prazo (Léo):** plataforma onde lojistas cadastram estoque e o consumidor compra (web → app).  
**Realidade técnica:** isso é um marketplace completo (catálogo + multi-loja + estoque + pagamento + logística). Dá para chegar lá em **fases**, cada uma com valor e validação próprios.

**Documentos relacionados:**

| Documento | Conteúdo |
|-----------|----------|
| `Telas_MVP.md` | Telas e UX do **MVP 1.0** (consulta) |
| `docs/MVP_VALIDACAO.md` | Pipeline 100 catálogos no Supabase |
| `docs/UX_MELHORIAS_BALCAO.md` | Pesquisa UX balcão + status por tela |
| `docs/HANDOFF_BACKEND_MELHORIAS.md` | Contratos backend → frontend (RPC, campos) |
| `docs/PRD_AGREGADOS.md` | Agregados de montagem (regras globais) |
| `PROJETO_HISTORICO.md` | Log operacional e sessões de implementação |
| `ARQUITETURA_ESCALA.md` | Escala de dados (500+ catálogos, infra) |

**Última revisão:** 06/07/2026 — alinhamento de produto (reunião Vinícius / Léo / equipe).

---

## 1. Analogia simples (para alinhar expectativa)

| Produto de referência | O que vocês constroem em cada fase |
|----------------------|-------------------------------------|
| **Google do catálogo de peças** | MVP 1.0 — buscar, ver foto, ref. cruzada, WhatsApp |
| **Planilha da loja na nuvem** | MVP 2.0 — lojista coloca preço e quantidade nos itens |
| **Vitrine com “falar no WhatsApp”** | MVP 2.5 (opcional) — preço visível, compra ainda manual |
| **Mercado Livre de autopeças** | MVP 3.0+ — carrinho, pagamento, pedido, entrega |

**MVP 1.0 não é Mercado Livre.** É a ferramenta que o vendedor **já precisa hoje** no balcão — e que prova que o catálogo consolidado funciona.

---

## 2. Mapa das fases (resumo)

```text
MVP 1.0  Catálogo consultável     ← VOCÊ ESTÁ AQUI (~70% — busca/código OK; veículo pendente)
    ↓
MVP 2.0  Loja + preço + estoque    ← lojista cadastra “a minha loja”
    ↓
MVP 2.5  Vitrine pública            ← preço final visível; compra via WhatsApp (até 3.0)
    ↓
MVP 3.0  Checkout + pagamento      ← compra na plataforma
    ↓
MVP 4.0  Escala nacional           ← busca dedicada, réplicas, filas, app
```

### Status consolidado MVP 1.0 (06/07/2026)

| Área | Status | Notas |
|------|--------|-------|
| Ingestão + ~86k produtos | 🟡 | Backfill normalização concluído; qualidade/amarração de catálogos em revisão |
| Busca por código / ref. cruzada | ✅ | RPC `buscar_produtos` + ranking por `match_tipo` |
| Busca por descrição | 🟡 | `pg_trgm` + texto; semântica fica para 1.2+ |
| Busca por veículo (ano/motor) | ⬜ | `/veiculo` placeholder; depende BE-06 + API placa |
| Detalhe + ref. cruzada + WhatsApp | ✅ | Fluxo balcão operacional |
| Agregados de montagem | 🟡 | MVP demo (`/agregados`); seed e restrição `dono` pendentes |
| Auth + multi-tenant loja | ✅ | Supabase Auth + RLS básico |
| Piloto em loja real | ⬜ | Aguarda fechamento 1.0.x |

---

## 2.1 Alinhamento de produto — reunião 06/07/2026

Fonte: reunião de alinhamento (tldv). Decisões que **repriorizam** o que vem antes do MVP 2.0.

### Princípios de busca (consenso)

| # | Decisão | Implicação técnica |
|---|---------|-------------------|
| 1 | **Código original (OEM)** é a métrica principal de identificação | Manter ranking: código exato → ref. → código normalizado; evoluir para OEM tipado (BE-07) |
| 2 | **Aplicação + ano + motorização** são critérios de desempate | Exigir `produto_aplicacoes` (BE-06) e filtros na busca quando termo for genérico |
| 3 | Uma peça pode ter **vários códigos originais** (por montadora), mas código **não se repete** entre peças diferentes | Modelar equivalências com confiança; fila de revisão para amarrações erradas dos catálogos |
| 4 | Ferramenta precisa da **relação código original ↔ conversões de catálogo** | `referencias_cruzadas` hoje é genérica; enriquecer com fonte OEM + docs Partes Link / código do pai |
| 5 | **Busca simples** é preferível a filtros complexos na UI principal | Wizard/filtros avançados como segundo passo, não como barreira na busca |
| 6 | **Busca por placa** → chassi → equipamentos pode eliminar filtros manuais | Épico veículo (Fase F); Leonardo pesquisa API |
| 7 | **Busca semântica** ajuda nomenclaturas diferentes, mas **depois** de código + veículo | P2 — não antecipar embeddings antes de BE-06 |
| 8 | **Normalização de números** (parser/backfill) tem **prioridade baixa** frente a veículo/OEM | Trabalho já feito melhora display; próximo salto = aplicação + catálogo, não mais parser |

### Dores de dados (bloqueadores)

| Problema | Ação |
|----------|------|
| Catálogos com erros de amarração entre peças | Auditoria + fila `sugestoes_correcao`; não confiar cegamente em rede de catálogos |
| `slug` vs `nome_exibicao` duplicados/incorretos | Auditar `catalogos` ↔ `produtos.origem_catalogo` (Fase A7) |
| Catálogos “não puxando corretamente” no sistema | Revisar ingestão + amostra Partes Link quando Leandro enviar docs |
| Termo genérico (“amortecedor”) gera confusão | Filtro por veículo/ano/motor + agregados de montagem |

### Itens de ação da reunião

| Responsável | Ação | Desbloqueia |
|-------------|------|-------------|
| **Vinícius** | Roadmap atualizado + próximos passos executáveis | Este documento § 4 e § 13 |
| **Leonardo** | Pesquisar API placa/chassi | Fase F — busca por placa |
| **Leandro** | Docs Partes Link + catálogo via WhatsApp | Ingestão OEM + qualidade de amarração |
| **Gustavo** | Documentação código original do pai | Mapeamento OEM como fonte de verdade |

---

| Fase | Venda online? | Pagamento | Quem cadastra o quê |
|------|---------------|-----------|---------------------|
| **1.0** | Não | Não | **Vocês** — catálogos via `main2.py` |
| **2.0** | Não | Não | **Lojista** — preço/estoque nos produtos do catálogo central |
| **2.5** | Não (lead) | Não | Lojista; cliente vê preço e pede no **WhatsApp** |
| **3.0** | Sim | Gateway | Lojista + fluxo de pedido na plataforma |
| **4.0** | Sim | Sim + escala | Infra do `ARQUITETURA_ESCALA.md` |

---

## 3. MVP 1.0 — Catálogo inteligente (consulta)

### Objetivo

Revenda consulta **dezenas de catálogos de fabricantes** num só lugar: busca rápida, foto, referência cruzada, origem do catálogo, envio para o cliente no WhatsApp.

### O que entra

- [x] Pipeline de ingestão (`main2.py` → Supabase)
- [x] App web responsiva + mobile-friendly (Next.js — telas do `Telas_MVP.md`)
- [x] Busca por código e descrição com ranking (`buscar_produtos`)
- [ ] Busca por veículo — aplicação, ano, motorização (Fase F)
- [x] Detalhe do produto + foto + referências cruzadas
- [x] “Enviar no WhatsApp” (texto + link/imagem)
- [x] Login básico por loja (Supabase Auth)
- [x] Normalização de exibição (`titulo_normalizado`, `codigo_principal`) — backfill ~86k
- [x] Agregados de montagem — MVP demo (`produto_relacoes`, `/agregados`)
- [ ] Autocomplete e guia visual de busca para vendedor novato (Fase E2)
- [ ] Validação com **100 catálogos** (`MVP_VALIDACAO.md`)
- [ ] Piloto 1–3 lojas no balcão (Fase C4)

### O que fica de fora (explícito)

- Preço do lojista
- Estoque da loja
- Carrinho e checkout
- Pagamento
- NF / PDV
- Lojista subir catálogo PDF (continua sendo vocês no 1.0)
- **Carrinho de orçamento sincronizado** — no 1.0 o carrinho vive no `localStorage`
  do navegador (não sincroniza entre dispositivos nem entre usuários da mesma loja).
  Persistência server-side do rascunho de orçamento entra no MVP 2.0 (ver § 5).

### Infra (suficiente)

- Supabase (Postgres + Storage + Auth)
- Front: Vercel / similar
- CDN nas imagens quando sair do free tier
- **Sem** load balancer, master/slave, Redis — ainda não precisa

### Critério de sucesso (“pronto para MVP 2”)

1. Vendedor encontra peça em **&lt; 3 segundos** no uso real.
2. Foto legível no WhatsApp.
3. Pelo menos **1 loja piloto** usa no balcão por 2–4 semanas.
4. Dados estáveis: 100 catálogos ingeridos com métricas conhecidas (produtos, erros, storage).

---

## 4. Passo a passo — MVP 1.0

Ordem sugerida **após alinhamento 06/07/2026**. Cada passo pode virar card no board.

### Fase A — Dados e qualidade de catálogo

| # | Passo | Status | Entregável |
|---|--------|--------|------------|
| A1 | Finalizar ingestão 100 catálogos | 🟡 | `catalogos` com status ok/erro |
| A2 | Tabela `catalogos` + `ingestao_jobs` | ✅ | Rastreio por catálogo |
| A3 | Fotos perfil WhatsApp (640 px) | 🟡 | Storage dentro da quota |
| A4 | RPC `buscar_produtos` com ranking | ✅ | `sql/migrations/002_*.sql` |
| A5 | Normalização de produtos + backfill | ✅ | `001_*.sql`, `scripts/backfill-normalizacao.ts` |
| A6 | Agregados de montagem | 🟡 | `004_produto_relacoes.sql`, `/agregados` |
| A7 | Auditar `slug` / `origem_catalogo` / `nome_exibicao` | ⬜ | Relatório SQL + correções na ingestão |
| A8 | Piloto ingestão Partes Link + código OEM | ⬜ | Depende docs Leandro / Gustavo |
| A9 | BE-06 — tabela `produto_aplicacoes` | ⬜ | Montadora, modelo, ano, motorização |

### Fase B — Produto (telas e UX balcão)

| # | Passo | Status | Entregável |
|---|--------|--------|------------|
| B1 | Protótipo Stitch (web + mobile) | ✅ | Fluxo validado |
| B2 | Projeto front Next.js + Supabase | ✅ | Repo app em produção (Vercel) |
| B3 | Tela busca + lista + filtros catálogo | 🟡 | Falta filtro veículo/ano na busca |
| B4 | Tela detalhe + ref. cruzada | ✅ | `produtos/[id]` |
| B5 | Copiar + WhatsApp + orçamento | ✅ | `localStorage` + RPC `salvar_orcamento` |
| B6 | Config mínima (nome loja, logo) | 🟡 | Tela existe; polish pendente |
| B7 | Agregados na busca e orçamento | 🟡 | Chips + “+ Agregados”; seed demo pendente |

### Fase C — Acesso e piloto

| # | Passo | Status | Entregável |
|---|--------|--------|------------|
| C1 | Auth Supabase | ✅ | 1 tenant = 1 revenda |
| C2 | RLS por loja | ✅ | Políticas em uso |
| C3 | Deploy produção | ✅ | HTTPS Vercel |
| C4 | Piloto 1–3 lojas | ⬜ | Feedback escrito + métricas de uso |

### Fase D — Fechamento 1.0

| # | Passo | Status | Entregável |
|---|--------|--------|------------|
| D1 | Corrigir top 10 dores do piloto | ⬜ | Lista priorizada |
| D2 | Runbook “como subir catálogo novo” | 🟡 | Parcial em `PROJETO_HISTORICO.md` |
| D3 | Decisão go/no-go MVP 2.0 | ⬜ | Reunião com Léo |

### Fase E — Busca inteligente 1.0.x (prioridade imediata pós-reunião)

*Quick wins de frontend — sem dependência de API de placa.*

| # | Passo | ID ref. | Status |
|---|--------|---------|--------|
| E1 | Destacar `match_valor` na linha da busca | FE-09 | ✅ 06/07/2026 |
| E2 | `titulo_normalizado` no dashboard/histórico | FE-16 | ✅ 06/07/2026 |
| E3 | Chips `medidas_extraidas` no detalhe | FE-17 | ✅ 06/07/2026 |
| E4 | `aplicacao_resumo` na linha da busca | — | ✅ 06/07/2026 (migration 005) |
| E5 | Guia visual de busca (3 exemplos no dashboard) | — | ⬜ |
| E6 | Autocomplete — histórico + sugestão de códigos | — | ⬜ |
| E7 | Drawer de produto (row click na busca) | FE-13 | ⬜ |
| E8 | Indicador de confiança do match | — | ⬜ |

Detalhes e critérios de aceite: `docs/HANDOFF_BACKEND_MELHORIAS.md`, `docs/UX_MELHORIAS_BALCAO.md`.

### Fase F — Busca por veículo (épico principal 1.1)

*Coração do alinhamento 06/07 — desbloqueia desempate por aplicação/ano.*

| # | Passo | Depende de |
|---|--------|------------|
| F1 | Migration `produto_aplicacoes` + extração na ingestão | BE-06 |
| F2 | Wizard `/veiculo`: montadora → modelo → ano → motor | BE-06 ou parsing incremental |
| F3 | Contexto veículo na busca (filtrar/refinar resultados) | F1 + F2 |
| F4 | Ranking com boost por aplicação compatível | RPC `buscar_produtos` v2 |
| F5 | API placa → chassi → pré-preencher wizard | Leonardo (API) |
| F6 | Vincular chassi a equipamentos da montadora | F5 + dados OEM |

**Duração indicativa restante do 1.0:** 4–8 semanas (Fase E em paralelo com A7/A9; Fase F após BE-06 ou API).

---

## 5. MVP 2.0 — Loja + preço + estoque (sem checkout)

### Objetivo

Cada revenda **associa o catálogo central ao negócio dela**: custo, margem, **preço final público**, quantidade em estoque. Ainda **não** há pagamento na plataforma — o **WhatsApp continua sendo o canal principal de venda** até o MVP 3.0.

### Decisões alinhadas (23/05/2026)

| # | Pergunta | Decisão |
|---|----------|---------|
| 1 | Preço interno ou público? | **Os dois.** Painel da loja mostra custo + margem; vitrine e WhatsApp mostram **preço final** (visão marketplace). |
| 2 | Estoque manual ou ERP? | **Camadas:** manual e CSV no 2.0; integrações ERP depois via adaptadores (ver seção 5.1). |
| 3 | WhatsApp até quando? | **Canal principal até o 3.0** — diferencial do produto; checkout in-app só entra na fase 3. |

### Modelo de preço (MVP 2.0)

```text
Lojista cadastra:
  preco_custo (opcional)  +  margem_%   →  preco_venda (calculado ou informado direto)
                                              ↓
                         preco_publico (= preco_venda, exibido na vitrine e no WhatsApp)
```

| Campo | Quem vê | Onde |
|-------|---------|------|
| `preco_custo` | Dono / estoquista | Painel interno |
| `margem_pct` | Dono / estoquista | Painel interno |
| `preco_venda` / `preco_publico` | Cliente + vendedor | Vitrine, busca “tenho em estoque”, mensagem WhatsApp |

Cada loja define **sua** margem sobre **seu** custo — o mesmo SKU no catálogo central pode ter preços diferentes em lojas diferentes (marketplace).

### Por que existe antes da venda

- Valida se lojistas **usam** a ferramenta para gestão.
- Exige **multi-tenant** e modelo de dados de estoque — base do marketplace.
- Pagamento é a parte mais regulada (PCI, chargeback, suporte); adiar reduz risco.
- **WhatsApp + preço** já entrega valor comercial antes de investir em gateway.

### O que entra

- Cadastro de **loja** (CNPJ, endereço, contato, logo, telefone WhatsApp)
- Usuários da loja (dono, vendedor, estoquista)
- Tabela `estoque_loja`: `loja_id`, `produto_id`, `preco_custo`, `margem_pct`, `preco_venda`, `quantidade`, `ativo`, `codigo_erp_loja` (opcional)
- Tela “meu estoque”: edição manual, import CSV, busca no catálogo e “adicionar à minha loja”
- Busca unificada: catálogo + filtro “só o que tenho em estoque”
- **WhatsApp com preço** na mensagem (atalhos — ver `Telas_MVP.md` § WhatsApp)
- Vitrine pública `/loja/{slug}` com preço (pode ser MVP 2.5 se quiser fatiar entrega)
- Opcional: alerta estoque baixo

### O que fica de fora

- Carrinho multi-item
- Gateway de pagamento
- Split de pagamento marketplace
- Frete calculado
- Emissão de NF

### Infra (incremento)

- RLS forte por `loja_id`
- Índices em `(loja_id, produto_id)`
- Cache leve (opcional) só se piloto 2.0 tiver lentidão
- Ainda **um** Postgres (Supabase Pro)

### Critério de sucesso

1. Lojista mantém **≥ 500 SKUs** com preço/estoque sem desistir.
2. Vendedor filtra “tenho em estoque” no balcão.
3. Zero vazamento de dados entre lojas (teste de segurança).

### Passo a passo — MVP 2.0

| # | Passo | Entregável |
|---|--------|------------|
| 2.1 | Modelar schema `lojas`, `usuarios_loja`, `estoque_loja` | Migration versionada |
| 2.2 | RLS + testes de isolamento | Script de teste |
| 2.3 | CRUD estoque (API ou Supabase direto) | Endpoints documentados |
| 2.4 | UI “adicionar do catálogo” | Fluxo &lt; 5 cliques |
| 2.5 | Import CSV (código + preço + qtd) | Template download |
| 2.6 | Piloto 3–5 lojas | 30 dias de uso |
| 2.7 | WhatsApp com preço + link vitrine | Template mensagem padronizado |
| 2.8 | Vitrine pública `/loja/{slug}` | Preço final visível |
| 2.9 | Piloto integração CSV recorrente | Loja exporta ERP 1×/dia |

**Duração indicativa:** 2–3 meses após 1.0 estável.

---

## 5.1 Estoque — arquitetura em camadas (manual → CSV → ERP)

Cada loja usa um **ERP/sistema diferente**. Não dá para integrar 50 ERPs no dia 1. A solução é um **hub de estoque na plataforma** com **adaptadores** por fonte de dados.

### Princípio

```text
                    ┌─────────────────────────────────────┐
  ERP / planilha    │         PLATAFORMA (fonte única)     │
  da loja           │  estoque_loja + sync_jobs + RLS      │
       │            └─────────────────────────────────────┘
       │                          ▲
       ▼                          │
  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌──────────────┐
  │ Manual  │   │  CSV    │   │ CSV     │   │ API ERP      │
  │ (UI)    │   │ upload  │   │ agendado│   │ (adaptador)  │
  └─────────┘   └─────────┘   └─────────┘   └──────────────┘
   MVP 2.0       MVP 2.0       MVP 2.1       MVP 2.2+
   imediato       imediato      automático    por ERP popular
```

A plataforma **não substitui** o ERP da loja no curto prazo — **espelha** estoque e preço para busca, vitrine e WhatsApp. O ERP continua sendo o sistema de verdade da loja; a sync mantém os dois alinhados.

### Camada 1 — Manual (MVP 2.0, sem dependência externa)

- Vendedor ou estoquista edita na UI: código, quantidade, preço/margem.
- Ideal para piloto e lojas pequenas.
- **Arquitetura:** CRUD direto em `estoque_loja` via Supabase + RLS.

### Camada 2 — CSV (MVP 2.0, prioridade alta)

Loja exporta do ERP (Bling, Tiny, Linx, planilha interna, etc.) e sobe um arquivo **no rush no formato padrão da plataforma**.

**Template CSV mínimo:**

```csv
codigo_produto,quantidade,preco_custo,margem_pct,preco_venda,codigo_erp_loja
201.0813,3,32.50,41.23,45.90,FRAM-2010813
PH2870A,0,28.00,,38.00,MAHLE-PH2870A
```

| Coluna | Obrigatório | Notas |
|--------|-------------|-------|
| `codigo_produto` | Sim | Casa com `produtos.codigo_produto_interno` ou ref. cruzada |
| `quantidade` | Sim | Inteiro ≥ 0 |
| `preco_venda` | Sim* | *Ou par `preco_custo` + `margem_pct` |
| `preco_custo` | Não | Só painel interno |
| `margem_pct` | Não | Calcula `preco_venda` se não informado |
| `codigo_erp_loja` | Não | Chave do ERP para próximas syncs |

**Fluxo técnico:**

1. Upload → bucket privado `imports/{loja_id}/{job_id}.csv`
2. Worker valida linhas (produto existe? preço válido?)
3. `UPSERT` em `estoque_loja` (`ON CONFLICT loja_id, produto_id`)
4. Registro em `sync_jobs` + relatório de erros (linhas ignoradas)

**Arquitetura:** Edge Function ou worker Python (pode reutilizar padrão do `main2.py`) + fila simples (`sync_jobs` com status).

### Camada 3 — CSV agendado (MVP 2.1)

- Loja configura: “todo dia às 6h envio por SFTP / URL assinada / e-mail parseado”.
- Mesmo parser da Camada 2 — só muda o **trigger**.
- **Arquitetura:** cron (Supabase pg_cron ou GitHub Actions) + mesmo worker.

### Camada 4 — API ERP (MVP 2.2+, sob demanda)

Um **adaptador por ERP** popular no segmento de autopeças — não um conector genérico.

```text
integracao_loja
  ├── loja_id
  ├── tipo: manual | csv | api_bling | api_tiny | api_linx | ...
  ├── credenciais (vault / Supabase secrets)
  ├── mapeamento_campos (JSONB)   ← codigo ERP → codigo catálogo
  └── ultima_sync_em

erp_adapters/
  ├── base.py          # interface: fetch_estoque() → List[EstoqueRow]
  ├── bling.py
  ├── tiny.py
  └── csv_adapter.py   # reutiliza parser CSV
```

| Abordagem | Quando | Esforço |
|-----------|--------|---------|
| CSV padrão | Sempre primeiro | Baixo — funciona com **qualquer** ERP que exporte |
| API oficial ERP | Loja piloto usa X e volume justifica | Médio — 1 ERP = 2–4 semanas |
| Webhook ERP | ERP notifica mudança de estoque | Médio — melhor latência |
| Integração bidirecional | Pedido 3.0 baixa estoque no ERP | Alto — fase pós-checkout |

**Regra de ouro:** novas lojas entram sempre por **CSV**; API só quando a loja (ou volume agregado) paga o custo de manter o adaptador.

### Tabelas sugeridas (sync)

```sql
-- Configuração por loja
CREATE TABLE integracao_loja (
    loja_id         BIGINT PRIMARY KEY REFERENCES lojas(id),
    tipo            VARCHAR(20) NOT NULL DEFAULT 'manual',  -- manual, csv, api_*
    config          JSONB DEFAULT '{}',
    ativo           BOOLEAN DEFAULT true,
    ultima_sync_em  TIMESTAMPTZ
);

-- Log de cada import/sync
CREATE TABLE sync_jobs (
    id              BIGSERIAL PRIMARY KEY,
    loja_id         BIGINT NOT NULL,
    tipo            VARCHAR(20),
    arquivo_path    VARCHAR(512),
    linhas_ok       INTEGER DEFAULT 0,
    linhas_erro     INTEGER DEFAULT 0,
    log_erros       JSONB,
    status          VARCHAR(20) DEFAULT 'pendente',
    iniciado_em     TIMESTAMPTZ DEFAULT now(),
    finalizado_em   TIMESTAMPTZ
);
```

### Resolução de código (ERP → catálogo central)

O ponto difícil: ERP da loja usa **código interno**; catálogo central usa **código fabricante + ref. cruzada**.

Ordem de match no import:

1. `codigo_produto` exato no catálogo
2. `numero_produto` / ref. cruzada
3. `codigo_erp_loja` já mapeado em sync anterior
4. Linha vai para **fila de revisão manual** (não aborta o job inteiro)

---

## 6. MVP 2.5 — Vitrine pública (ponte até o 3.0)

### Objetivo

URL pública da loja: cliente vê produtos **com preço** e clica **“Pedir no WhatsApp”** (sem pagamento na plataforma).

### Papel no produto

Com preço **público** decidido no 2.0, a vitrine é a **porta de entrada B2C** enquanto o checkout (3.0) não existe. **WhatsApp é o CTA principal** — não um botão secundário.

### O que entra

- Página `/loja/{slug}` com catálogo filtrado `estoque_loja.ativo = true` e `quantidade > 0`
- **Preço final** visível (nunca custo/margem)
- SEO básico, OG image para preview no WhatsApp
- Botão **“Pedir no WhatsApp”** com mensagem pré-preenchida (código + descrição + **preço** + link vitrine)

### O que fica de fora

- Pagamento in-app
- Reserva automática de estoque no clique

---

## 7. MVP 3.0 — Compra na plataforma

### Objetivo

Cliente **compra** no site: carrinho → pagamento → pedido → lojista é notificado.

**WhatsApp não some no 3.0** — deixa de ser o *único* canal de venda e passa a ser:

- Confirmação de pedido e status (“seu pedido saiu para entrega”)
- Atalho para dúvidas pós-compra
- Opção alternativa para lojas que preferem fechar no wa.me (modo híbrido)

### O que entra (alto nível)

- Carrinho e checkout
- Gateway (Mercado Pago / Pagar.me / Stripe BR)
- Pedidos: `pedidos`, `itens_pedido`, status
- Reserva/debito de estoque (transação no Postgres)
- E-mail/WhatsApp de confirmação
- Painel lojista: pedidos novos, marcar enviado/entregue

### O que ainda pode ficar para 3.1+

- Multi-loja no mesmo carrinho
- Split automático de comissão
- Rastreio Correios integrado
- NF-e

### Infra (começa a valer sua arquitetura)

- Redis (sessão, carrinho, cache)
- Filas (webhook pagamento, notificações)
- WAF/CDN na borda
- Réplica read se busca pesar
- Ambiente staging + testes de carga leves

**Duração indicativa:** 4–6 meses (primeira versão de checkout bem feita).

---

## 8. MVP 4.0 — Escala (visão Léo)

Só quando métricas justificarem:

- Motor de busca dedicado (Meilisearch / Typesense)
- Master + réplica Postgres
- Auto-scaling de API
- App mobile nativo ou PWA instalável
- 500+ catálogos no catálogo central (`ARQUITETURA_ESCALA.md`)

---

## 9. Decisões — status

### Alinhadas (23/05/2026) — MVP 1.0

| # | Decisão |
|---|---------|
| Correção de dados | **Sim**, com regra por tipo de dado (§ 9.1) |
| Contas | **1 revenda = 1 loja (tenant)**; dono cadastra **vendedores** dentro da conta (§ 9.2) |

### Alinhadas (23/05/2026) — MVP 2.0

| # | Decisão |
|---|---------|
| Preço | **Interno + público:** custo/margem no painel; **preço final** na vitrine e WhatsApp |
| Estoque | **Manual + CSV no 2.0;** ERP via adaptadores depois (§ 5.1) |
| WhatsApp | **Canal principal de venda até o 3.0** — diferencial do produto |
| Multi-loja | Mesmo SKU = **preços diferentes** por loja (marketplace) |

### 9.1 Correção — o que o lojista pode alterar

Existem **dois tipos de dado**. A confusão costuma ser achar que “nome, preço e quantidade” são tudo a mesma coisa — não são.

| Dado | Exemplo | Quem manda no catálogo central | O que o lojista faz |
|------|---------|-------------------------------|---------------------|
| **Catálogo central** | Descrição Fram, foto, ref. cruzada, aplicação veículo | **Vocês** (pipeline `main2.py`) | **Sugerir correção** (MVP 1.0) — não edita direto |
| **Dados da loja** | Preço de venda, quantidade, margem, apelido local | **O lojista** | **Edita direto** (MVP 2.0) |

#### MVP 1.0 — “Sugerir correção” no catálogo central

Quando o vendedor vê algo errado no dado **do fabricante/catálogo** (veio do PDF):

- Descrição errada ou incompleta  
- Foto trocada / ilegível  
- Referência cruzada faltando ou incorreta  
- Código que não bate com a peça física  

**Fluxo:** botão **“Reportar erro”** na tela de detalhe → formulário curto → fila `sugestoes_correcao` → vocês ou admin aprovam → atualizam o catálogo central (beneficia **todas** as lojas).

**Por que não editar direto?** O catálogo é **compartilhado**. Se a Loja A mudar a descrição errado, a Loja B também recebe o erro.

**Preço e quantidade no 1.0:** ainda **não existem** por loja — entram no **2.0** (`estoque_loja`), com edição direta pelo lojista.

#### MVP 2.0 — Edição direta (dados da loja)

| Campo | Edição |
|-------|--------|
| Preço de custo | Dono / estoquista |
| Margem % | Dono / estoquista |
| Preço final | Calculado ou informado |
| Quantidade em estoque | Dono / estoquista / import CSV |
| Apelido local (opcional) | Ex.: “Filtro Gol kit” — só na vitrine daquela loja |

Nome/descrição **oficial** do produto continua vindo do catálogo central; apelido local é opcional por loja.

---

### 9.2 Contas — 1 revenda, vários vendedores

**Modelo escolhido:** uma **revenda = uma loja (tenant)**. Não é um login compartilhado na senha do dono — cada pessoa tem **seu** login, ligado à **mesma loja**.

```text
Revenda “Autopeças Silva” (loja_id = 42)
├── Roberto (dono)      → cadastra loja, convida equipe, vê custo/margem
├── Carlos (vendedor)   → busca, WhatsApp, copiar código
├── Ana (vendedor)      → idem, mobile piso
└── João (estoquista)   → import CSV, ajusta quantidade/preço
```

| Papel | Permissões típicas |
|-------|-------------------|
| **dono** | Tudo + convidar/remover usuários + config loja |
| **vendedor** | Busca, detalhe, WhatsApp, copiar — **sem** ver custo (opcional) |
| **estoquista** | Estoque, preço, import CSV — **sem** convidar usuários |

**Implementação (Supabase Auth):**

- Tabela `lojas` (tenant)  
- Tabela `membros_loja` (`user_id`, `loja_id`, `papel`)  
- RLS: `loja_id` do JWT ou join em `membros_loja`  
- Dono convida por **e-mail** (magic link ou senha) — fluxo na tela W09 Config  

**MVP 1.0 mínimo:** dono + 1–2 vendedores já bastam para o piloto. Gestão completa de papéis pode ser simplificada (só `dono` e `vendedor`) e `estoquista` entra no 2.0.

### Ainda em aberto — MVP 3.0

1. Quem emite NF — lojista ou plataforma?
2. Modelo de receita: assinatura, % por venda, ou ambos?
3. Entrega: só retirada, só envio, ou ambos?
4. Uma compra = uma loja ou carrinho multi-loja?

---

## 10. O que NÃO fazer em cada fase

| Erro comum | Por quê evitar |
|------------|----------------|
| Colocar pagamento no MVP 1.0 | Atrasa meses; catálogo ainda não está validado |
| Lojista subir PDF no 1.0 | Parsing é o core de vocês; libera só quando processo estiver maduro |
| Montar cluster Kubernetes no 1.0 | Custo e ops sem tráfego |
| Prometer “igual Mercado Livre” na data do 1.0 | Expectativa errada com investidor/cliente |
| Pular MVP 2.0 e ir direto para venda | Sem estoque confiável, overselling e suporte caótico |

---

## 11. Stack sugerida por fase

| Camada | MVP 1.0 | MVP 2.0 | MVP 3.0 |
|--------|---------|---------|---------|
| Front | Next.js + Tailwind | + painel estoque | + checkout |
| API | Supabase + PostgREST / Edge | + RPC estoque | FastAPI ou Edge para pedidos |
| Auth | Supabase Auth | + roles | + buyer account |
| DB | Supabase Postgres | + RLS loja | + transações pedido |
| Imagens | Supabase Storage + CDN | idem | idem |
| Busca | Postgres FTS / ilike | + filtros estoque | Meilisearch |
| Pagamento | — | — | Mercado Pago etc. |
| Cache | — | opcional Redis | Redis |
| Infra edge | Cloudflare free | Cloudflare | WAF + LB |

---

## 12. WhatsApp — estratégia por fase

| Fase | O que vai na mensagem | CTA |
|------|------------------------|-----|
| **1.0** | Código, descrição, fabricante, foto (link CDN) | Compartilhar com cliente/mecânico |
| **2.0** | Tudo acima + **preço final** + “Disponível: N un.” | Vendedor envia orçamento |
| **2.5** | Preço + link `/loja/{slug}` | Cliente clica **Pedir no WhatsApp** |
| **3.0** | Confirmação pedido + rastreio | Venda in-app; WhatsApp = pós-venda |

Atalhos técnicos e templates: `Telas_MVP.md` § **14. WhatsApp (diferencial)**.

---

## 13. Próximas ações executáveis (06/07/2026)

### Esta semana — dev (sem dependência externa)

| # | Ação | Fase | Owner |
|---|------|------|-------|
| 1 | ~~FE-09 + FE-16 + FE-17 (match, dashboard, medidas)~~ | E1–E3 | ✅ 06/07/2026 |
| 2 | ~~`aplicacao_resumo` na linha da busca~~ (migration 005) | E4 | ✅ 06/07/2026 |
| 2b | ~~Busca federada TecDoc (PostgREST VPS)~~ | A10 / BE-10 | ✅ 16/07/2026 |
| 3 | Guia visual de busca no dashboard | E5 | Dev |
| 4 | Validar demo agregados (1 principal + 2 itens) | B7 | Dev + produto |
| 5 | SQL de auditoria `catalogos` ↔ `produtos.origem_catalogo` | A7 | Dev |

### Paralelo — dependências da equipe

| # | Ação | Owner | Desbloqueia |
|---|------|-------|-------------|
| 6 | Pesquisa API placa/chassi | Leonardo | F5 |
| 7 | Docs Partes Link + catálogo | Leandro | A8 |
| 8 | Docs código original (pai) | Gustavo | A8, BE-07 |

### Próximas 2–4 semanas

| # | Ação | Fase |
|---|------|------|
| 9 | BE-06 `produto_aplicacoes` + hook ingestão | A9, F1 |
| 10 | Wizard `/veiculo` (sem placa primeiro) | F2 |
| 11 | Autocomplete na busca | E6 |
| 12 | Drawer de produto na busca | E7 |
| 13 | Executar `MVP_VALIDACAO.md` (100 catálogos) | A1 |
| 14 | Iniciar piloto C4 com 1 loja | C4 |

### Já concluído (não repetir)

- ~~Alinhar preço/estoque/WhatsApp para 2.0~~ — **feito** (§ 9).
- ~~Fechar perguntas em aberto do 1.0~~ — **feito** (§ 9.1, § 9.2).
- ~~RPC busca + normalização + orçamento transacional~~ — **feito** (03/07/2026).
- ~~MVP demo agregados~~ — **feito** (06/07/2026, migration `004`).
- ~~Busca federada TecDoc~~ — **feito** (16/07/2026, BE-10).

### Critério “1.0 pronto para piloto”

1. Vendedor acha peça por **código ou ref.** em &lt; 3 s ✅
2. Vendedor refina busca genérica com **contexto de veículo** ⬜ (Fase F)
3. Foto legível no WhatsApp ✅
4. Catálogos auditados sem slugs órfãos ⬜ (A7)
5. 1 loja piloto usando 2+ semanas ⬜ (C4)

---

## 14. Resumo em uma frase

> **MVP 1.0 vende o catálogo; MVP 2.0 vende preço + estoque + WhatsApp; MVP 3.0 vende checkout.** ERP entra por CSV primeiro, API depois — sem bloquear o lançamento.

---

## 15. Documentos do repositório

| Arquivo | Conteúdo |
|---------|----------|
| `Telas_MVP.md` | UX, fluxos, atalhos WhatsApp |
| `docs/MVP_VALIDACAO.md` | Pipeline 100 catálogos |
| `docs/UX_MELHORIAS_BALCAO.md` | Pesquisa UX + status por tela |
| `docs/HANDOFF_BACKEND_MELHORIAS.md` | Contratos RPC e campos normalizados |
| `docs/PRD_AGREGADOS.md` | Agregados de montagem |
| `ARQUITETURA_ESCALA.md` | Escala catálogo + sync estoque (§ 13) |
| `PROJETO_HISTORICO.md` | Log operacional |

---

*Criado em 23/05/2026 · Decisões 2.0: 23/05/2026 · Revisão alinhamento produto: 06/07/2026.*
