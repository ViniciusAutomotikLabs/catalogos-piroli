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

2. **Settings → Build and Deployment → Framework Preset** → **Next.js**  
   Se estiver **Python**, o build falha (procura `main.py` em vez de `npm run build`).  
   O arquivo `app/vercel.json` também força `nextjs`, mas confira no painel.

3. **Install Command / Build Command** → deixe **Override desligado** (padrão do Next.js).

4. **Settings → Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

5. Deploy do último commit em `main`.

### Variáveis (copiar do `.env` local)

| `.env` local | Vercel |
|---|---|
| `SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| publishable / anon key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

Nunca use `SUPABASE_SERVICE_ROLE_KEY` como `NEXT_PUBLIC_*`.
