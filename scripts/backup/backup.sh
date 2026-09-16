#!/usr/bin/env bash
# ERP 2.0 — Executa backup pgBackRest. Uso: backup.sh [full|incr|diff]
# Agende via cron (ver docs/erp-2.0/INFRA.md). Requer PGBACKREST_REPO1_CIPHER_PASS
# no ambiente se o repo for cifrado.
set -euo pipefail

STANZA="erp"
TYPE="${1:-incr}"

case "$TYPE" in
  full|incr|diff) ;;
  *) echo "Tipo inválido: $TYPE (use full|incr|diff)" >&2; exit 1 ;;
esac

echo "[$(date -Is)] Backup $TYPE da stanza $STANZA"
sudo -u postgres pgbackrest --stanza="$STANZA" --type="$TYPE" backup
echo "[$(date -Is)] Concluído. Info:"
sudo -u postgres pgbackrest --stanza="$STANZA" info
