# Roadmap MVP — Do catálogo ao marketplace

Guia passo a passo para evoluir o produto **sem tentar construir um Mercado Livre de uma vez**.

**Visão de longo prazo (Léo):** plataforma onde lojistas cadastram estoque e o consumidor compra (web → app).  
**Realidade técnica:** isso é um marketplace completo (catálogo + multi-loja + estoque + pagamento + logística). Dá para chegar lá em **fases**, cada uma com valor e validação próprios.

**Documentos relacionados:**

| Documento | Conteúdo |
|-----------|----------|
| `Telas_MVP.md` | Telas e UX do **MVP 1.0** (consulta) |
| `docs/MVP_VALIDACAO.md` | Pipeline 100 catálogos no Supabase |
| `ARQUITETURA_ESCALA.md` | Escala de dados (500+ catálogos, infra) |

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
MVP 1.0  Catálogo consultável     ← VOCÊ ESTÁ AQUI (dados + telas)
    ↓
MVP 2.0  Loja + preço + estoque    ← lojista cadastra “a minha loja”
    ↓
MVP 2.5  Vitrine pública            ← preço final visível; compra via WhatsApp (até 3.0)
    ↓
MVP 3.0  Checkout + pagamento      ← compra na plataforma
    ↓
MVP 4.0  Escala nacional           ← busca dedicada, réplicas, filas, app
```

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
- [ ] App web responsiva + mobile-friendly (telas do `Telas_MVP.md`)
- [ ] Busca por código, descrição, veículo (quando houver aplicação)
- [ ] Detalhe do produto + foto + referências cruzadas
- [ ] “Enviar no WhatsApp” (texto + link/imagem)
- [ ] Login básico por loja (mesmo que simples no início)
- [ ] Validação com **100 catálogos** (`MVP_VALIDACAO.md`)

### O que fica de fora (explícito)

- Preço do lojista
- Estoque da loja
- Carrinho e checkout
- Pagamento
- NF / PDV
- Lojista subir catálogo PDF (continua sendo vocês no 1.0)

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

Ordem sugerida. Cada passo pode virar card/tarefa no board.

### Fase A — Dados (já em andamento)

| # | Passo | Entregável |
|---|--------|------------|
| A1 | Finalizar ingestão 100 catálogos | `catalogos` com status ok/erro |
| A2 | Tabela `catalogos` + `ingestao_jobs` | Rastreio por catálogo |
| A3 | Fotos perfil WhatsApp (640 px) | Storage dentro da quota |
| A4 | Smoke test de busca no SQL | Query por código e descrição aceitável |

### Fase B — Produto (telas)

| # | Passo | Entregável |
|---|--------|------------|
| B1 | Protótipo Stitch (web + mobile) | Fluxo validado com Léo |
| B2 | Projeto front (Next.js ou similar) | Repo app consumindo Supabase |
| B3 | Tela busca + lista + filtros | Chips montadora/modelo/ano |
| B4 | Tela detalhe + ref. cruzada | Bottom sheet mobile |
| B5 | Ação “Copiar” + “WhatsApp” | Deep link / share API |
| B6 | Tela config mínima (nome loja, logo) | Persona Roberto |

### Fase C — Acesso e piloto

| # | Passo | Entregável |
|---|--------|------------|
| C1 | Auth Supabase (email ou magic link) | 1 tenant = 1 revenda |
| C2 | RLS: usuário só vê dados da própria loja | Políticas testadas |
| C3 | Deploy produção (URL fixa) | HTTPS |
| C4 | Piloto 1–3 lojas | Feedback escrito + métricas de uso |

### Fase D — Fechamento 1.0

| # | Passo | Entregável |
|---|--------|------------|
| D1 | Corrigir top 10 dores do piloto | Lista priorizada |
| D2 | Documentar “como subir catálogo novo” | Runbook para vocês |
| D3 | Decisão go/no-go MVP 2.0 | Reunião com Léo |

**Duração indicativa:** 2–4 meses (depende de quantas pessoas codam e quantos layouts de PDF novos aparecem).

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

## 13. Próxima ação concreta (esta semana)

1. ~~Alinhar preço/estoque/WhatsApp para 2.0~~ — **feito** (§ 9).
2. **Travar escopo das telas** em `Telas_MVP.md` — nada de preço/carrinho no protótipo **1.0**.
3. **Executar** `MVP_VALIDACAO.md` (100 catálogos).
4. **Abrir** repositório do front assim que protótipo Stitch aprovado.
5. ~~Fechar perguntas em aberto do 1.0~~ — **feito** (§ 9.1, § 9.2).

---

## 14. Resumo em uma frase

> **MVP 1.0 vende o catálogo; MVP 2.0 vende preço + estoque + WhatsApp; MVP 3.0 vende checkout.** ERP entra por CSV primeiro, API depois — sem bloquear o lançamento.

---

## 15. Documentos do repositório

| Arquivo | Conteúdo |
|---------|----------|
| `Telas_MVP.md` | UX, fluxos, atalhos WhatsApp |
| `docs/MVP_VALIDACAO.md` | Pipeline 100 catálogos |
| `ARQUITETURA_ESCALA.md` | Escala catálogo + sync estoque (§ 13) |
| `PROJETO_HISTORICO.md` | Log operacional |

---

*Criado em 23/05/2026 · Decisões 2.0 alinhadas em 23/05/2026. Revisar após piloto MVP 1.0.*
