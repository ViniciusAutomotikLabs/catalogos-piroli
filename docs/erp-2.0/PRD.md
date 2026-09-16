# PRD — ERP 2.0 Piroli Autopeças

**Versão**: 0.1 (kickoff)
**Fonte primária**: reunião 08/09/2026 — ver [FONTES_REUNIAO.md](FONTES_REUNIAO.md)
**Escopo deste PRD**: módulo Pessoas (P0) + fundações (multi-tenant, entitlements, IA/tokens, segurança). Financeiro/fechamento (P1) e monetização/marketing/fiscal (P2) descritos em alto nível.

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

### P1 — Operação e IA

- **FR-030** Fechamento mensal para N destinatários; pasta de fotos de nota por pessoa; revisão humana antes do envio.
- **FR-031** Status de título (gerado/enviado/pago) e agrupamento de duplicatas (modelo previsto, UI depois).
- **FR-032** Comissão de oficina/mecânico obrigatória na venda + relatório mensal.
- **FR-033** Módulo IA (Ollama/DGX via Tailscale) server-side, entitlement-gated, com medição de tokens e degradação graciosa.

### P2 — Produto

- **FR-040** Recarga de tokens via gateway Pix (webhook credita `token_ledger`).
- **FR-041** Planos/pacotes de módulos + billing.
- **FR-042** Módulo marketing/imagens; módulo fiscal; Serasa por consulta; frete Correios/Jadlog.

## 7. Implementation Phases

1. Docs + schema (Pessoas, entitlements, tokens) com segurança embutida. ← este ciclo
2. Módulo Pessoas no Next.js (form + webcam + compat).
3. Infra self-host + backups (paralelo).
4. Módulo IA + medição de tokens.
5. P1 operação (fechamento/comissão).
6. P2 monetização/marketing/fiscal.

## 8. Risks & Mitigations

| Risco | Mitigação |
|---|---|
| Inflar v1 copiando o SS Plus | scope-drift check; non-goals explícitos |
| Vazamento cross-tenant | RLS em tudo + testes; nunca service role em query de usuário |
| Cripto quebrar busca | camadas + blind index em campos buscáveis |
| Self-host não escalar | pooler + storage em objeto + read replica quando pesar |
| Perda de dados | backup PITR em VPS separada + teste de restore |
| DGX indisponível | degradação graciosa; IA fora do caminho crítico |
