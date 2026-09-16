# ERP 2.0 — Infraestrutura (self-host)

Topologia alvo (aprovada na reunião). Tudo conversa por **Tailscale** (rede privada);
nada sensível exposto na internet pública além do proxy HTTPS da app.

```
┌───────────────────────────────────────────────────────────────────────┐
│                          Tailnet (Tailscale)                            │
│                                                                         │
│  VPS-APP (Coolify)            VPS-DB (Postgres)         VPS-DGX (IA)     │
│  ┌───────────────────┐        ┌──────────────────┐     ┌─────────────┐  │
│  │ Next.js (ERP 2.0) │        │ PostgreSQL 16     │     │ Ollama      │  │
│  │ Supabase stack:   │──SQL──▶│  + WAL archiving  │     │ (llama3.1…) │  │
│  │  GoTrue/PostgREST │        │  (pgBackRest)     │     └──────▲──────┘  │
│  │  Storage/Realtime │        └────────┬─────────┘            │         │
│  │  Studio/Kong      │                 │ WAL + base           │ fetch   │
│  └─────────┬─────────┘                 │ (repo1)              │ server  │
│            │ HTTPS (público)           ▼                      │ side    │
│            │                  VPS-BACKUP (IP distinto)        │         │
│            │                  ┌──────────────────┐            │         │
│            └──── usuários     │ pgBackRest repo  │◀───────────┘         │
│                               │ (PITR) + offsite │                      │
│                               └──────────────────┘                      │
└───────────────────────────────────────────────────────────────────────┘
```

## 1. VPS-DB — PostgreSQL dedicado

- Postgres 16, disco cifrado (LUKS) — cobre "disco cifrado" da camada de segurança.
- Só escuta na interface Tailscale (`listen_addresses` = IP tailnet + localhost).
- `pg_hba.conf`: permite apenas o VPS-APP (subrede tailnet) via `scram-sha-256`.
- Extensões que o Supabase espera: `pgcrypto`, `pgjwt`, `uuid-ossp`, `pg_stat_statements`.
- WAL para PITR:
  ```conf
  wal_level = replica
  archive_mode = on
  archive_command = 'pgbackrest --stanza=erp archive-push %p'
  max_wal_senders = 3
  ```

## 2. VPS-APP — Coolify + Supabase self-host

Objetivo: **manter o código atual** — só trocam URLs/keys. Passos:

1. Instalar Coolify na VPS-APP.
2. Subir o **stack Supabase** (template oficial self-host) apontando o `POSTGRES_HOST`
   para o IP Tailscale da VPS-DB (banco isolado; resto do Supabase roda aqui).
3. Configurar domínio + TLS (Let's Encrypt via Traefik do Coolify) → satisfaz "Forçar HTTPS".
4. Deploy do Next.js (este repo) como app do Coolify.
5. Definir **secrets** no Coolify (não no `.env` do repo):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://supabase.seu-dominio`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = anon/publishable do self-host
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role do self-host (server-only)
   - `ERP_ENCRYPTION_KEY`, `ERP_BLIND_INDEX_KEY` = `openssl rand -base64 32`
   - `OLLAMA_BASE_URL` = `http://<ip-tailscale-dgx>:11434`, `OLLAMA_MODEL`
6. **Rate limiting** no proxy (Traefik middleware) para `/` e especialmente rotas de IA.

### Migração dos dados (Supabase gerenciado → self-host)

```bash
# Dump do projeto atual (roles + schema + dados) e restore no Postgres novo.
pg_dump "$SUPABASE_GERENCIADO_URL" --no-owner --no-privileges -Fc -f erp.dump
pg_restore --no-owner --no-privileges -d "$POSTGRES_SELFHOST_URL" erp.dump
# Aplicar migrations ERP 2.0 na ordem:
for f in sql/migrations/00[7-9]_*.sql sql/migrations/010_*.sql; do
  psql "$POSTGRES_SELFHOST_URL" -f "$f"
done
# Storage (buckets/objetos): migrar via API de Storage ou rclone entre os buckets.
```

## 3. VPS-DGX — Ollama (IA)

- Ollama escuta **apenas** na interface Tailscale (`OLLAMA_HOST=0.0.0.0` atrás do tailnet,
  ou bind no IP tailnet). Nunca exposto publicamente.
- O app fala com ele **server-side** (`src/lib/ai/ollama.ts`) — o browser nunca vê o endpoint.
- Consumo medido por loja no `token_ledger` (débito) + `ia_uso` (log). Sem saldo → bloqueia.

## 4. VPS-BACKUP — PITR com pgBackRest (IP distinto)

Ver scripts em [`scripts/backup/`](../../scripts/backup/):

- `pgbackrest.conf` — stanza `erp`, repo na VPS-BACKUP, retenção e cifra do repositório.
- `install-backup.sh` — provisiona pgBackRest no VPS-DB e cria a stanza.
- `backup.sh` — full (semanal) + incremental (diário); rode via cron/systemd.
- `restore-test.sh` — **teste de restore mensal** num container/instância descartável.
  Backup sem teste de restore é backup que não existe.

Cron sugerido (no VPS-DB):
```cron
0 2 * * 0  /opt/erp/backup.sh full   >> /var/log/erp-backup.log 2>&1  # domingo
0 2 * * 1-6 /opt/erp/backup.sh incr  >> /var/log/erp-backup.log 2>&1  # seg-sáb
```

RPO alvo: ≤ 5 min (WAL archiving contínuo). RTO alvo: ≤ 1 h (restore + replay).
Cópia **offsite** do repo (S3/Backblaze) além da VPS-BACKUP para resistir à perda do datacenter.
