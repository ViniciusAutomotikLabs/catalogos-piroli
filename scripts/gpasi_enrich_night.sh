#!/usr/bin/env bash
# gpasi_enrich_night.sh — retry de skipped na madrugada (prio 0001).
#
# - Prioriza grupo 0001 (timeouts)
# - Empty → permanente (não loop)
# - Timeout → cooldown 6h
# - Auto-heal imagem; exit 0 para o timer não falhar em loop

set -u

OPT_DIR="${GPASI_SYNC_DIR:-/opt/gpasi-sync}"
IMAGE="${GPASI_SYNC_IMAGE:-gpasi-sync:latest}"
ENV_FILE="${OPT_DIR}/.env"
DOCKERFILE="${OPT_DIR}/gpasi_sync.Dockerfile"
SCRIPT="${OPT_DIR}/gpasi_redis_sync.py"
CONTAINER="${GPASI_ENRICH_NIGHT_CONTAINER:-gpasi-redis-enrich-night}"
NETWORK="${GPASI_DOCKER_NETWORK:-easypanel}"
BATCH="${ENRICH_NIGHT_BATCH:-8}"
LOG_TAG="gpasi-enrich-night"

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [$LOG_TAG] $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { log "ERROR: missing command $1"; exit 1; }
}

need_cmd docker
need_cmd systemctl

if [[ ! -f "$ENV_FILE" ]]; then
  log "ERROR: missing $ENV_FILE"
  exit 1
fi
# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

ensure_image() {
  if docker image inspect "$IMAGE" >/dev/null 2>&1; then
    return 0
  fi
  log "image $IMAGE missing → building"
  docker build -t "$IMAGE" -f "$DOCKERFILE" "$OPT_DIR"
}

run_night() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  systemctl stop gpasi-redis-prices.timer gpasi-redis-catalog.timer >/dev/null 2>&1 || true
  systemctl stop gpasi-redis-prices.service gpasi-redis-catalog.service >/dev/null 2>&1 || true
  # Evita overlap com enrich diurno
  systemctl stop gpasi-redis-enrich.service >/dev/null 2>&1 || true

  set +e
  docker run --rm --name "$CONTAINER" \
    --network "$NETWORK" \
    -e REDIS_HOST="${REDIS_HOST:-tecdoc_redis}" \
    -e REDIS_PORT="${REDIS_PORT:-6379}" \
    -e REDIS_PASSWORD \
    -e User_gestao \
    -e Senha_gestao \
    -e ip_gestao \
    -e "ENRICH_NIGHT_BATCH=$BATCH" \
    -e ENRICH_NIGHT=1 \
    -v "${OPT_DIR}:${OPT_DIR}:ro" \
    "$IMAGE" \
    python "$SCRIPT" --enrich-retry-skips --night --enrich-batch "$BATCH"
  local rc=$?
  set -e

  systemctl start gpasi-redis-prices.timer gpasi-redis-catalog.timer >/dev/null 2>&1 || true
  return "$rc"
}

ensure_image
log "starting night retry batch=$BATCH"
if ! run_night; then
  rc=$?
  log "night failed rc=$rc — rebuild + retry once"
  docker build -t "$IMAGE" -f "$DOCKERFILE" "$OPT_DIR" || {
    log "ERROR: rebuild failed"
    exit 1
  }
  if ! run_night; then
    log "ERROR: night retry failed — exit 0 para timer seguir"
    exit 0
  fi
fi

log "night tick OK"
exit 0
