#!/usr/bin/env bash
# ERP 2.0 — Teste de restore (PITR) mensal em instância DESCARTÁVEL.
# NUNCA rode contra o data dir de produção. Restaura o último backup + WAL num
# diretório temporário, sobe um Postgres efêmero e valida uma query.
#
# Uso: restore-test.sh [YYYY-MM-DD HH:MM:SS]   # alvo opcional de PITR
set -euo pipefail

STANZA="erp"
PG_VERSION="${PG_VERSION:-16}"
PG_BIN="/usr/lib/postgresql/${PG_VERSION}/bin"
RESTORE_DIR="$(mktemp -d /tmp/erp-restore-XXXX)"
PORT="55432"
TARGET_TIME="${1:-}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$RESTORE_DIR" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$RESTORE_DIR"
}
trap cleanup EXIT

echo "==> Restaurando em $RESTORE_DIR (porta $PORT)"
if [[ -n "$TARGET_TIME" ]]; then
  sudo -u postgres pgbackrest --stanza="$STANZA" --type=time \
    --target="$TARGET_TIME" --target-action=promote \
    --pg1-path="$RESTORE_DIR" restore
else
  sudo -u postgres pgbackrest --stanza="$STANZA" --pg1-path="$RESTORE_DIR" restore
fi

echo "==> Subindo Postgres efêmero"
"$PG_BIN/pg_ctl" -D "$RESTORE_DIR" -o "-p $PORT" -w start

echo "==> Validando dados (tabelas ERP 2.0)"
psql -p "$PORT" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'pessoas' AS tabela, count(*) FROM public.pessoas
UNION ALL SELECT 'token_ledger', count(*) FROM public.token_ledger
UNION ALL SELECT 'lojas', count(*) FROM public.lojas;
SQL

echo "==> Restore-test OK. Limpando."
