# ERP 2.0 — Segurança (checklist dos 20 pontos)

Este documento rastreia os 20 requisitos de segurança levantados na reunião e o estado
de cada um no código/infra. Legenda: ✅ implementado · 🟡 parcial/config · ⬜ pendente (infra).

A base é **criptografia em camadas** (aprovada): TLS + disco cifrado + **colunas sensíveis
cifradas na aplicação** (AES‑256‑GCM) + **blind index** (HMAC) para campos buscáveis. Um dump
vazado é inútil sem as chaves — que vivem em secrets, nunca no banco.

| # | Requisito | Estado | Onde |
|---|-----------|--------|------|
| 1 | Esconder API keys / limpar segredos do Git | 🟡 | `.env` git-ignored; `.env.example` só placeholders. Limpeza de histórico: ver §Git abaixo |
| 2 | Criptografia dos dados (ponta a ponta em camadas) | ✅ | `src/lib/crypto/index.ts` (AES-256-GCM), colunas `*_cifrado`/`*_bidx` nas migrations 007/009 |
| 3 | Chaves públicas p/ acesso ao banco + RLS | ✅ | Anon/publishable no app; RLS em todas as tabelas (007–010) |
| 4 | Autenticação server-side | ✅ | Supabase SSR (`src/lib/supabase/server.ts`, `proxy.ts`, middleware Node) |
| 5 | Acesso restrito (menor privilégio) | ✅ | RLS por organização/loja; `service_role` só em `src/lib/supabase/admin.ts` (escritas privilegiadas) |
| 6 | Bloquear Mass Assignment | ✅ | Whitelist explícita nas actions (`parsePessoaInput`); `REVOKE UPDATE(organizacao_id)` (007) |
| 7 | Proteger cookies | ✅ | Cookies do Supabase SSR (httpOnly/secure/sameSite geridos pela lib) |
| 8 | Hash de senhas | ✅ | Delegado ao Supabase Auth (GoTrue, bcrypt) |
| 9 | Rate limiting | ⬜ | Fazer no proxy (Coolify/Traefik) + rota de IA. Doc em `INFRA.md` |
| 10 | Proteção contra bots | 🟡 | Auth + rate limit; CAPTCHA opcional no login (P1) |
| 11 | Queries parametrizadas | ✅ | PostgREST/supabase-js parametriza; sem SQL string no app |
| 12 | Validação de input | ✅ | Validação/whitelist manual nas actions + CHECKs no schema |
| 13 | Prevenir vazamento de conteúdo | ✅ | `SELECT` de colunas explícitas; documento nunca volta em claro (só máscara) |
| 14 | Restringir uploads | ✅ | Bucket `pessoas` privado, tipos/imagem e tamanho validados (`captura-foto.tsx`), policies por org (010) |
| 15 | Enxugar respostas da API | ✅ | Selects enxutos; nenhum `select('*')` em dados sensíveis |
| 16 | Security headers | ✅ | `next.config.ts` `headers()`: CSP, HSTS, X-Frame-Options, nosniff, Permissions-Policy |
| 17 | Forçar HTTPS | ✅ | HSTS (`Strict-Transport-Security`) + redirect no proxy (Coolify) |
| 18 | Escopo de tokens/segredos | ✅ | `service_role` server-only; chaves de cripto fora do banco |
| 19 | Auditoria | ✅ | Tabela `auditoria` (007); actions registram INSERT/UPDATE/DELETE de pessoas |
| 20 | Scan de dependências | ✅ | CI `.github/workflows/security.yml` (`npm audit`) |

## Git — limpeza de segredos do histórico (#1)

`.env` está no `.gitignore` e não é rastreado. Se em algum commit antigo houver segredo:

```bash
# Ver se .env já foi commitado alguma vez
git log --all --full-history -- .env

# Se sim, reescrever histórico (destrutivo — combine com a equipe):
#   pipx install git-filter-repo
git filter-repo --path .env --invert-paths
# Depois: ROTACIONE todas as chaves expostas (Supabase, cripto, service_role).
```

Regra de ouro: qualquer chave que **já esteve** num commit deve ser considerada vazada e
rotacionada, mesmo após limpar o histórico.

## Criptografia — operação

- Gerar chaves: `openssl rand -base64 32` (uma para `ERP_ENCRYPTION_KEY`, outra para `ERP_BLIND_INDEX_KEY`).
- Guardar como **secrets do Coolify** (não no `.env` do repo, não no Postgres).
- Rotação de `ERP_ENCRYPTION_KEY` exige re-cifrar as colunas (script de migração de chave — P1).
  O formato do payload já carrega um byte de versão (`VERSION`) para suportar rotação.

## Enforcement por módulo (multi-tenant)

Cada rota/menu exige um módulo (`src/lib/modulos.ts`); `requireModulo()` bloqueia acesso
server-side. Super admin libera módulos por loja em `loja_modulos` (migration 008).
