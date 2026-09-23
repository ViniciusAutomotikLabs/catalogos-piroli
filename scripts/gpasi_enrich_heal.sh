#!/usr/bin/env bash
# Heal horário: imagem, timers enrich+night, purge lixo da fila, reset-failed.
set -u
OPT_DIR=/opt/gpasi-sync
IMAGE=gpasi-sync:latest
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [gpasi-enrich-heal] $*"; }

if [[ -f "$OPT_DIR/.env" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "$OPT_DIR/.env"
  set +a
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  log "image missing → rebuild"
  docker build -t "$IMAGE" -f "$OPT_DIR/gpasi_sync.Dockerfile" "$OPT_DIR" || exit 1
fi

# Timers essenciais
for t in gpasi-redis-enrich.timer gpasi-redis-enrich-night.timer gpasi-redis-enrich-heal.timer; do
  systemctl is-enabled "$t" >/dev/null 2>&1 || systemctl enable --now "$t" >/dev/null 2>&1 || true
  systemctl is-active "$t" >/dev/null 2>&1 || systemctl start "$t" >/dev/null 2>&1 || true
done

systemctl reset-failed gpasi-redis-enrich.service >/dev/null 2>&1 || true
systemctl reset-failed gpasi-redis-enrich-night.service >/dev/null 2>&1 || true

# Purge junk IDs (sem grupo:bloco) da fila de skip
if command -v docker >/dev/null; then
  PW="${REDIS_PASSWORD:-}"
  R=(docker exec tecdoc_redis redis-cli -a "$PW" --no-auth-warning)
  # Remove membros sem ':'
  mapfile -t members < <("${R[@]}" SMEMBERS gpasi:meta:enrich_skipped_blocos 2>/dev/null || true)
  junk=0
  for m in "${members[@]:-}"; do
    [[ -z "$m" ]] && continue
    if [[ "$m" != *:* ]]; then
      "${R[@]}" SREM gpasi:meta:enrich_skipped_blocos "$m" >/dev/null 2>&1 || true
      junk=$((junk + 1))
    fi
  done
  next=$("${R[@]}" GET gpasi:meta:enrich_next_bloco 2>/dev/null || true)
  skipped=$("${R[@]}" SCARD gpasi:meta:enrich_skipped_blocos 2>/dev/null || echo 0)
  empty=$("${R[@]}" SCARD gpasi:meta:enrich_skip_empty 2>/dev/null || echo 0)
  cov=$("${R[@]}" GET gpasi:meta:aplicacao_coverage 2>/dev/null || echo 0)
  log "cursor=${next:-?} skipped=${skipped:-0} skip_empty=${empty:-0} junk_purged=$junk aplic_cov=${cov:-0}"
fi
exit 0
