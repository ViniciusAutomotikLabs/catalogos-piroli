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

Monorepo: Python na raiz + Next.js em `app/`.

### Configuração (obrigatório)

1. **Settings → General → Root Directory** → `app` → Save  
   Sem isso a Vercel detecta `requirements.txt` e tenta Python.

2. **Settings → Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

3. **Não** sobrescreva Install/Build Command no painel — deixe o preset **Next.js** padrão (`npm ci` + `npm run build` dentro de `app/`).

4. Faça deploy do último commit em `main` (evite “Redeploy” de builds antigos).

### Variáveis (copiar do `.env` local)

| `.env` local | Vercel |
|---|---|
| `SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| publishable / anon key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

Nunca use `SUPABASE_SERVICE_ROLE_KEY` como `NEXT_PUBLIC_*`.
