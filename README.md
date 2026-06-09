# Catálogo Industrial — App Web

Next.js (App Router) + Supabase Auth + RLS. Parte do monorepo **Projeto Leo** — o pipeline Python fica na raiz do repo.

## Desenvolvimento local

```bash
cd app
cp .env.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Deploy na Vercel

Este repo é um **monorepo**: a raiz tem `requirements.txt` (Python) e o frontend fica em `app/`.

### Opção A — recomendada (painel Vercel)

1. **Settings → General → Root Directory** → `app`
2. **Settings → Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Redeploy

### Opção B — build pela raiz (já configurado)

O `vercel.json` na raiz do repo força framework **Next.js** e roda `npm install/build` dentro de `app/`. Mesmas variáveis de ambiente acima.

**Nunca** coloque `SUPABASE_SERVICE_ROLE_KEY` em variáveis `NEXT_PUBLIC_*`.
