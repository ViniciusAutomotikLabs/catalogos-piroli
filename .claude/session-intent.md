# Intent Contract

**Created**: 2026-09-23T14:53:00Z
**Workflow**: fase-5.1-vendas-erp
**Status**: completed

## Job Statement

Tornar o módulo Vendas do ERP 2.0 usável no balcão: o vendedor converte orçamento em venda e vê as vendas de hoje com total e status — sem depender da SS Plus.

## Success Criteria

### Good Enough
- Lista `/vendas` com filtro por dia (default hoje) e status
- Cards com quantidade e soma do dia (excl. canceladas)
- Nome do cliente na lista e no detalhe
- Empty state com CTA para `/orcamento` e aviso de que vendas SS não entram aqui
- Converter orçamento → redirect `/vendas/{id}` com `codigo` nos itens para reserva no espelho
- Fechar venda gera título visível em `/caixa`

### Exceptional
- Badges de status/entrega polidos + link orçamento/caixa no detalhe

## Boundaries
- Não é clone PDV da SS
- Não migra histórico/vendas da SS (fase 7)
- Não convite de funcionários (fase 6)
- Sem NF-e, formas de pagamento ricas, multi-caixa, entrega parcial por item, UI completa de comissão

## Context & Constraints

**Stakeholders**: Vendedor/caixa Piroli (piloto)
**Existing Assets**: `vendas.ts` actions, shell `/vendas`, `/caixa`, `/entregas`, orçamento+cart
**Technical Constraints**: Next.js App Router, Supabase RLS, design tokens existentes

## Validation Checklist
- [x] Meets "good enough" criteria (lista/detalhe/converter; smoke DB venda #1 + título)
- [x] Respects all boundaries
- [x] Works for balcão stakeholders
- [x] Builds on existing vendas/caixa assets

## Verification evidence (2026-09-23)
- `npx tsc --noEmit` exit 0
- Smoke SQL: venda id=1 status=fechada, cliente, item 000100; financeiro_titulos aberto R$43,33; vendas_hoje=1
- UI auth-gated (browser → /login); dados confirmados no Postgres