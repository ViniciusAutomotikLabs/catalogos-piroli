#!/usr/bin/env bash
# ERP 2.0 — Provisiona pgBackRest no VPS-DB e cria a stanza `erp`.
# Rode como root no VPS-DB (Postgres já instalado). O VPS-BACKUP deve ter o usuário
# `pgbackrest` e o repo em /var/lib/pgbackrest, acessível por SSH via Tailscale.
set -euo pipefail

STANZA="erp"
PG_VERSION="${PG_VERSION:-16}"

echo "==> Instalando pgBackRest"
if command -v apt-get >/dev/null; then
  apt-get update -y && apt-get install -y pgbackrest
else
  echo "Distro sem apt-get: instale pgbackrest manualmente." >&2
  exit 1
fi

echo "==> Verificando config em /etc/pgbackrest/pgbackrest.conf"
if [[ ! -f /etc/pgbackrest/pgbackrest.conf ]]; then
  echo "Copie scripts/backup/pgbackrest.conf para /etc/pgbackrest/pgbackrest.conf antes." >&2
  exit 1
fi

if [[ -z "${PGBACKREST_REPO1_CIPHER_PASS:-}" ]]; then
  echo "AVISO: PGBACKREST_REPO1_CIPHER_PASS não definido — o repo não ficará cifrado." >&2
fi

echo "==> Ajuste no postgresql.conf (WAL archiving)"
PGCONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
if [[ -f "$PGCONF" ]]; then
  grep -q "pgbackrest --stanza=${STANZA} archive-push" "$PGCONF" || cat >> "$PGCONF" <<EOF

# --- ERP 2.0 pgBackRest ---
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=${STANZA} archive-push %p'
max_wal_senders = 3
EOF
  echo "   Config aplicada. Reinicie o Postgres: systemctl restart postgresql"
else
  echo "   $PGCONF não encontrado — ajuste o WAL archiving manualmente." >&2
fi

echo "==> Criando stanza ${STANZA}"
sudo -u postgres pgbackrest --stanza="${STANZA}" stanza-create
sudo -u postgres pgbackrest --stanza="${STANZA}" check

echo "==> OK. Agende scripts/backup/backup.sh no cron (ver docs/erp-2.0/INFRA.md)."
