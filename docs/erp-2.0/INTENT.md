# Intent Contract — ERP 2.0 Piroli Autopeças

**Criado**: 2026-09-15
**Workflow**: kickoff ERP 2.0
**Status**: active

## Job Statement

Construir um ERP para autopeças que a Piroli usa no balcão no lugar do SS Plus, começando pelo cadastro de pessoas (cliente/fornecedor/vendedor/funcionário/oficina/mecânico), e que já nasça como **produto multi-loja revendável** — com módulos liberáveis por loja, IA vendida por consumo (tokens via DGX/Ollama) e segurança forte desde o schema.

A Piroli é o **piloto**; a arquitetura é de produto.

## Success Criteria

### Good Enough (v1)

- Cadastro de pessoas unificado, com papéis em vez de um "tipo" único.
- Foto da pessoa capturada por webcam (must-have) com fallback de upload.
- Multi-tenant por organização/unidade com RLS em toda tabela.
- Módulos liberáveis por loja via super admin (entitlements).
- Fundação de segurança aplicada no schema (RLS, least privilege, cripto seletiva + blind index, anti mass assignment).
- Orçamento e busca atuais continuam funcionando (compat de `clientes`).

### Exceptional

- Módulo de IA (Ollama no DGX via Tailscale) com medição de tokens desde o dia 1.
- Ledger append-only de tokens pronto para monetização (gateway em P2).
- Infra self-host (Supabase no Coolify + Postgres em VPS dedicada) com backup PITR na 4ª VPS.

## Boundaries (o que este ciclo NÃO é)

- Não é clone do SS Plus (sem 11 abas, sem RH no cadastro comercial, sem Complemento PJ inchado).
- Não implementa NF-e, boleto Sicredi, agrupamento de duplicatas, disparo WhatsApp oficial, Rede Âncora nem módulo de marketing/imagens neste ciclo.
- Não é E2EE zero-knowledge (incompatível com busca/relatório/IA server-side).
- Não trava desenvolvimento esperando as VPS: schema e código correm antes do deploy.
- **Cutover completo SS → ERP** (clientes + histórico de vendas + demais entidades via API) **está no plano P1** (fases 5–7 do PRD), mas **não** neste ciclo imediato: primeiro vendas novas no ERP + convites; migração em massa é job noturno com throttle.

## Context & Constraints

**Stakeholders**: Leandro (operação/dono), Gustavo (mecânico/sócio), Léo (produto/tech), caixa, financeiro (Jaci), vendedores. Clientes finais = oficinas e mecânicos.
**Existing Assets**: app Next.js 15 + Supabase (Auth/Storage/RLS/RPC), catálogo de ~86k produtos, CRUD de clientes, busca, orçamento, espelho estoque GPASI, shell de vendas/RH.
**Infra alvo**: Postgres (VPS dedicada) + Supabase self-host (Coolify) + DGX/Ollama (Tailscale) + backup (4ª VPS).
**Cripto**: camadas (TLS + LUKS + coluna seletiva + blind index); chaves em secrets do Coolify.
**API GPASI**: latência alta e limites de chamada — migração e enrich só via filas/checkpoint (ver PRD § 7.2).

## Validation Checklist

- [ ] Cadastro de pessoas cobre os papéis do SS Plus sem as abas inúteis
- [ ] Webcam funcionando com fallback
- [ ] RLS em todas as tabelas novas
- [ ] Entitlements liberáveis por super admin
- [ ] Ledger de tokens e medição no módulo de IA
- [ ] Colunas sensíveis cifradas + blind index nos campos buscáveis
- [ ] Orçamento/busca não quebraram
