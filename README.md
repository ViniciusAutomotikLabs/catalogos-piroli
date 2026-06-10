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
Se a Vercel detectar Python, o build falha com *"No python entrypoint found"* — isso é esperado: o app é Next.js, não Python.

### Passo obrigatório (Hobby / free)

1. Vercel → projeto **catalogo** → **Settings → General**
2. **Root Directory** → `app` → Save
3. **Settings → Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://oxqojsmlbptmofmhyfea.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = chave `sb_publishable_...`
4. **Deployments** → abra o deploy mais recente da branch `main` (não “Redeploy” de um commit antigo)
5. Ou faça um push novo em `main` para disparar build automático

### Variáveis — o que copiar do `.env` local

| Local (`.env` na raiz) | Vercel (só estas duas) |
|---|---|
| `SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` ou anon key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

**Nunca** coloque `SUPABASE_SERVICE_ROLE_KEY` na Vercel como `NEXT_PUBLIC_*` — ela é secreta e só serve ao pipeline Python local.

### Fallback (se não usar Root Directory)

Na raiz do repo existem `vercel.json` + `.vercelignore` para forçar Next.js e ignorar `requirements.txt` no upload.
Mesmo assim, **Root Directory = `app`** é a configuração mais confiável.
