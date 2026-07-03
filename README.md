# Catálogo Industrial — App Web

App **Next.js 15 (App Router)** + **Supabase** (Auth + Postgres com RLS) para revendas de
autopeças consultarem um catálogo consolidado de fornecedores, montarem orçamentos e
enviarem por WhatsApp.

> Modelo de contas: **1 revenda = 1 loja (tenant)**. Ver `docs/ROADMAP_MVP.md` para a visão
> de produto (MVP 1.0 → marketplace) e `docs/UX_MELHORIAS_BALCAO.md` para a pesquisa de UX.

## Stack

- Next.js 15 (App Router) + React 19
- Tailwind CSS 4
- Supabase (`@supabase/ssr` + `@supabase/supabase-js`)
- Deploy na Vercel

## Estrutura

```
src/
  app/            # rotas (App Router)
    login/        # tela pública de login
    (app)/        # área autenticada (layout protegido)
  components/     # componentes de UI
  lib/            # supabase, ações de servidor, helpers (whatsapp, cart, loja, env)
  middleware.ts   # refresh de sessão + guarda de rotas (Supabase SSR)
sql/              # schema tenant + políticas RLS
docs/             # roadmap e pesquisa de UX
```

## Desenvolvimento local

Pré-requisitos: Node 20+ e um projeto Supabase.

```bash
cp .env.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Scripts:

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Sobe o build |
| `npm run lint` | ESLint |

## Variáveis de ambiente

Somente as variáveis públicas do Supabase são necessárias para o app web:

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (browser + servidor) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publishable/anon |

> **Nunca** exponha `SUPABASE_SERVICE_ROLE_KEY` nem `DATABASE_URL` no app (não prefixe com
> `NEXT_PUBLIC_`). Essas credenciais são exclusivas do pipeline de ingestão / ambientes de
> servidor. Consulte `.env.example` para o conjunto completo (com placeholders).

## Deploy na Vercel

1. **Settings → Framework Preset** → **Next.js**
2. **Settings → Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Deploy do último commit em `main`.

## Autenticação e proteção de rotas

- `src/middleware.ts` chama `updateSession` (`src/lib/supabase/proxy.ts`) para renovar os
  cookies de sessão e redirecionar: usuário não autenticado → `/login`; usuário autenticado
  em `/login` → `/`.
- O layout `src/app/(app)/layout.tsx` também valida o contexto da loja
  (`getContextoLoja`) e exibe aviso quando a conta não está vinculada a uma loja.

## Banco de dados

Schema e políticas em `sql/`:

- `sql/schema_tenant.sql` — tabelas (catálogo compartilhado + dados por loja)
- `sql/rls_policies.sql` — políticas RLS (catálogo compartilhado, dados por tenant, ações de dono)
- `sql/reset_dados.sql` — reset de dados para desenvolvimento
