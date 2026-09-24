# PRD — ERP 2.0 Piroli Autopeças

**Versão**: 0.2 (cutover SS + vendas + convites)
**Fonte primária**: reunião 08/09/2026 — ver [FONTES_REUNIAO.md](FONTES_REUNIAO.md); alinhamento operacional 22–23/09/2026 (espelho estoque, ficha SS, vendas vazias no ERP).
**Escopo deste PRD**: módulo Pessoas (P0) + fundações + **espelho/estoque**, **vendas no ERP**, **login/convite de funcionários** e **migração completa SS → ERP** (P1 cutover). Financeiro/fechamento avançado e monetização/marketing/fiscal (P2) em alto nível.

## 1. Executive Summary

ERP para revendas de autopeças, nascido do uso real da Piroli (hoje no SS Plus). Substitui primeiro a tela de cadastro — a mais usada e a mais bagunçada — e cresce em torno do catálogo/busca que já existe. Arquitetura de produto: multi-loja, módulos liberáveis por assinatura, IA vendida por consumo (DGX/Ollama), segurança forte por padrão.

## 2. Problem Statement

O SS Plus mistura tudo num cadastro (cliente, fornecedor, vendedor, funcionário, mecânico, transportador), esconde permissões noutro menu, trava tipos de cliente, não tem foto, só manda fechamento para 1 destinatário, não mostra status de boleto e obriga caminhos longos para tarefas simples. Resultado: a operação "apanha" e depende de processos manuais (foto no Drive, fechamento de 5 dias na mão).

## 3. Goals & Metrics

| Meta | Prioridade | Métrica de sucesso |
|---|---|---|
| Cadastro de pessoas usável no balcão | P0 | Piroli cadastra/edita pessoa sem recorrer ao SS Plus |
| Foto por webcam | P0 | Foto capturada e vinculada em < 10s |
| Multi-tenant seguro | P0 | Zero acesso cross-tenant (RLS em 100% das tabelas) |
| Módulos liberáveis | P0 | Super admin liga/desliga módulo por loja |
| Espelho estoque/preço SS (live + sync) | P0/P1 | Balcão consulta saldo/filiais/marca/fab no ERP |
| Vendas no ERP (sem depender da SS) | P1 | Orçamento → venda → entrega/caixa no app; lista “hoje” útil |
| Login de funcionários por convite | P1 | Admin manda link; funcionário acessa do PC da loja com conta própria |
| Migração completa SS → ERP (cutover) | P1 | Clientes + histórico de vendas + demais entidades via API; SS vira fallback |
| IA medida por consumo | P1 | Tokens contados por loja em toda chamada |
| Fechamento multi-destinatário | P1 | Envio para N contatos (cliente/secretária/contador) |
| Monetização de IA | P2 | Recarga via gateway credita tokens |

## 4. Non-Goals (v1)

- NF-e / módulo fiscal completo, boleto Sicredi, agrupamento de duplicatas.
- Disparo WhatsApp oficial, CRM de cobrança com IA, Rede Âncora/CNA.
- Módulo de marketing/imagens, planos/billing.
- E2EE zero-knowledge.
- RH (férias/licenças) dentro do cadastro comercial.

## 5. Personas

- **Leandro (dono/operação)**: quer estrutura bem feita e configurável; pensa em revender.
- **Gustavo (mecânico/sócio)**: foco em comissão de oficina/mecânico e no dia a dia.
- **Caixa**: tira foto da nota, cadastra rápido no balcão.
- **Jaci (financeiro)**: fechamento mensal, cobrança, boletos.
- **Vendedor**: atende cliente, precisa de permissões corretas e clientes autorizados.
- **Super admin (nós)**: libera módulos, gerencia lojas e IA/tokens.

## 6. Functional Requirements

### P0 — Módulo Pessoas

- **FR-001** Cadastro único de pessoa PF/PJ com dados básicos.
- **FR-002** Papéis por checkbox (cliente, fornecedor, vendedor, funcionário, entregador, oficina, mecânico); papéis extras configuráveis pela organização.
- **FR-003** N contatos (e-mail/WhatsApp/SMS) com flag de destino de fechamento/cobrança.
- **FR-004** Foto por webcam (getUserMedia + canvas) com fallback `input file`; bucket privado + signed URL.
- **FR-005** N endereços; blind index em CNPJ/CPF para busca por igualdade.
- **FR-006** Veículos relacionados **com inclusão e exclusão**.
- **FR-007** Grupo comercial configurável por organização (à vista, mensal, credital, expresso...).
- **FR-008** Regras por unidade: desconto global/por unidade, formas de pagamento permitidas, vendedores autorizados, modo de entrega.
- **FR-009** Seções condicionais por papel: financeiro só se cliente; comissão só se oficina/mecânico; RH fora.
- **FR-010** Auditoria: quem alterou o quê e quando.
- **FR-011** Compat: `clientes` atuais visíveis como pessoas com papel cliente; orçamento/busca não quebram.

### P0 — Fundações

- **FR-020** Organização → unidades → pessoas; RLS por organização em toda tabela.
- **FR-021** Usuário de sistema e permissões separados do cadastro comercial.
- **FR-022** Entitlements: `modulos`, `loja_modulos`, `super_admins`; sidebar/rota/RLS respeitam módulos ativos.
- **FR-023** Segurança: colunas sensíveis cifradas, blind index, grants por coluna (anti mass assignment), validação de input.

### P1 — Vendas no ERP (balcão neste sistema)

> Hoje `/vendas` lê só `public.vendas` do ERP — **não** há sync de PDV/pedidos da SS. A lista vazia é esperada até este bloco.

- **FR-050** Fluxo completo: orçamento → converter venda → fechar → fila de entrega → baixa no espelho.
- **FR-051** Página Vendas: filtros (hoje / periodo / status / vendedor), totais do dia, detail com itens.
- **FR-052** Caixa / contas a receber mínimas ligadas à venda (já esboçado em `financeiro`).
- **FR-053** Comissão oficina/mecânico na venda (liga a FR-032).
- **FR-054** Venda criada **neste** sistema é a fonte de verdade operacional pós-piloto; histórico SS entra depois via migração (FR-070+).

### P1 — Acesso de funcionários (convite pelo admin)

> Não é login compartilhado na senha do dono. Admin (dono/super) convida; cada um tem conta própria na mesma loja/org.

- **FR-060** Tela Admin/Config: convidar funcionário por e-mail (magic link ou define senha) → vínculo `membros_loja` / org + papel (`vendedor`, `caixa`, `estoquista`, …).
- **FR-061** Link do sistema (URL produção/piloto) enviado pelo admin; funcionário acessa do computador da empresa.
- **FR-062** Papéis respeitam `loja_modulos` + RLS; vendedor não vê custo/margem se política assim definir.
- **FR-063** Revogar acesso / reenviar convite sem apagar o cadastro comercial de pessoa (FR-021).

### P1 — Migração completa SS → ERP (cutover)

> Trabalho grande. API GPASI tem **limites de taxa e latência** (`/peca/dados` ~30–60s/bloco; vários endpoints só noturnos). Não é sync em tempo real de tudo.

- **FR-070** Inventário do que a API expõe vs. o que só existe na UI SS (gap report).
- **FR-071** Migrar **clientes / pessoas** com perfil o mais completo possível (cadastro, contatos, endereços, veículos, grupo comercial) — mapear para `pessoas` + papéis.
- **FR-072** Migrar **histórico de vendas / pedidos** (cabeçalho + itens + status) para tabelas ERP (`vendas` / espelho de pedidos legado), com `fonte=ss` e id externo.
- **FR-073** Demais entidades trazíveis via API (fornecedores, títulos, agregados, fabricantes/marcas, etc.) em filas priorizadas.
- **FR-074** Pipeline **assíncrono**: jobs noturnos, checkpoint por bloco/cursor, backoff, soft-throttle; nunca varrer a API no request do balcão.
- **FR-075** Critério de cutover: piloto opera N semanas só no ERP; SS em leitura/fallback; flag `sync_legado_ativo` só para o que ainda precisar espelhar.
- **FR-076** Reconciliação: totais SS vs ERP (clientes, vendas/dia, estoque rede) com relatório de divergência.

### P1 — Operação e IA (já previstos)

- **FR-030** Fechamento mensal para N destinatários; pasta de fotos de nota por pessoa; revisão humana antes do envio.
- **FR-031** Status de título (gerado/enviado/pago) e agrupamento de duplicatas (modelo previsto, UI depois).
- **FR-032** Comissão de oficina/mecânico obrigatória na venda + relatório mensal.
- **FR-033** Módulo IA (Ollama/DGX via Tailscale) server-side, entitlement-gated, com medição de tokens e degradação graciosa.

### P2 — Produto

- **FR-040** Recarga de tokens via gateway Pix (webhook credita `token_ledger`).
- **FR-041** Planos/pacotes de módulos + billing.
- **FR-042** Módulo marketing/imagens; módulo fiscal; Serasa por consulta; frete Correios/Jadlog.

## 7. Implementation Phases

Ordem atualizada (22–23/09/2026). O que já avançou fica marcado.

| # | Fase | Prioridade | Status | Notas |
|---|------|------------|--------|-------|
| 1 | Docs + schema (Pessoas, entitlements, tokens) + segurança | P0 | ✅ | Migrations 007–012+ |
| 2 | Módulo Pessoas no Next.js (form + webcam + compat) | P0 | 🟡 | Em uso no piloto |
| 3 | RH básico (contratos/férias/folha) | P0/P1 | 🟡 | Fora do cadastro comercial |
| 4 | Espelho estoque/preço GPASI + ficha SS (fab, marca, filiais, agregados) | P0/P1 | 🟡 | Sync + UI `/estoque`; foto API ainda quebrada |
| 5 | **Vendas no ERP** — páginas + fluxo balcão (FR-050–054) | **P1** | ⬜ | Shell `/vendas` existe; **sem** dados SS |
| 6 | **Convite/login de funcionários** (FR-060–063) | **P1** | ✅ | Admin manda link; conta própria |
| 7 | **Migração completa SS → ERP** (FR-070–076) | **P1 cutover** | ⬜ | Jobs noturnos + throttle API; clientes + vendas + resto |
| 8 | Infra self-host + backups | P1 | ⬜ | Paralelo |
| 9 | Módulo IA + medição de tokens | P1 | ⬜ | |
| 10 | Operação (fechamento/comissão avançada) | P1 | ⬜ | Após vendas estáveis |
| 11 | P2 monetização/marketing/fiscal | P2 | ⬜ | |

### 7.1 Onde isso **não** entra

- **Não** é MVP marketplace 3.0 (`docs/ROADMAP_MVP.md` § 7) — checkout B2C / pagamento online.
- **Não** é “só sync de estoque” (fase 4) — cutover é **histórico e cadastros**, além do espelho.
- Vendas **do dia na SS** só aparecem no ERP após fase 7 (ou se forem lançadas na fase 5 neste app).

### 7.2 Restrições de API (obrigatório no plano de migração)

| Restrição | Implicação |
|-----------|------------|
| Rate / latência alta em `/peca/dados` e listagens grandes | Só jobs noturnos; checkpoint; backoff |
| Endpoints de pedido/CRM/financeiro sensíveis | Preferir leitura; escrita só com runbook e ambiente certo |
| Códigos empresa espelho/AUX | Nunca somar estoque das 10 empresas — só filiais físicas |
| Quota / estabilidade GPASI | Soft-throttle; se `[]` sob carga, retentar no timer |

## 8. Risks & Mitigations

| Risco | Mitigação |
|---|---|
| Inflar v1 copiando o SS Plus | scope-drift check; non-goals explícitos; cutover em filas priorizadas |
| Vazamento cross-tenant | RLS em tudo + testes; nunca service role em query de usuário |
| Cripto quebrar busca | camadas + blind index em campos buscáveis |
| Self-host não escalar | pooler + storage em objeto + read replica quando pesar |
| Perda de dados | backup PITR em VPS separada + teste de restore |
| DGX indisponível | degradação graciosa; IA fora do caminho crítico |
| API GPASI lenta / limitada no cutover | Jobs noturnos, checkpoint, não bloquear balcão; gap report FR-070 |
| Esperar migração para poder vender no ERP | Fase 5 primeiro (vendas novas neste app); fase 7 traz o histórico |
