#!/usr/bin/env bash
# gpasi_enrich_autonomous.sh — enrich autônomo com auto-heal.
#
# - Garante imagem gpasi-sync:latest (rebuild se faltar)
# - Garante scripts em /opt/gpasi-sync
# - Roda enrich batch (ENRICH_BATCH, default 10)
# - Se docker falhar (125 / image), rebuild + 1 retry
# - Não limpa gpasi:aplic:*; resume pelo cursor Redis
# - Exit 0 sempre que o job “andou” ou no-op de ciclo completo
#   (systemd timer não entra em failed loop)

set -u

OPT_DIR="${GPASI_SYNC_DIR:-/opt/gpasi-sync}"
IMAGE="${GPASI_SYNC_IMAGE:-gpasi-sync:latest}"
ENV_FILE="${OPT_DIR}/.env"
DOCKERFILE="${OPT_DIR}/gpasi_sync.Dockerfile"
SCRIPT="${OPT_DIR}/gpasi_redis_sync.py"
CONTAINER="${GPASI_ENRICH_CONTAINER:-gpasi-redis-enrich-sync}"
NETWORK="${GPASI_DOCKER_NETWORK:-easypanel}"
BATCH="${ENRICH_BATCH:-10}"
LOG_TAG="gpasi-enrich-auto"

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

ensure_scripts() {
  if [[ ! -f "$SCRIPT" ]]; then
    log "ERROR: missing $SCRIPT"
    exit 1
  fi
  if [[ ! -f "$DOCKERFILE" ]]; then
    log "WARN: missing Dockerfile; writing minimal one"
    cat >"$DOCKERFILE" <<'EOF'
FROM python:3.12-slim
WORKDIR /opt/gpasi-sync
RUN pip install --no-cache-dir redis==5.2.1
CMD ["python", "/opt/gpasi-sync/gpasi_redis_sync.py", "--full"]
EOF
  fi
}

ensure_image() {
  if docker image inspect "$IMAGE" >/dev/null 2>&1; then
    return 0
  fi
  log "image $IMAGE missing → building from $DOCKERFILE"
  docker build -t "$IMAGE" -f "$DOCKERFILE" "$OPT_DIR"
}

heal_timers() {
  # Garante que o timer de enrich está enabled; reativa siblings se alguém derrubou.
  systemctl is-enabled gpasi-redis-enrich.timer >/dev/null 2>&1 \
    || systemctl enable gpasi-redis-enrich.timer >/dev/null 2>&1 || true
  systemctl is-active gpasi-redis-enrich.timer >/dev/null 2>&1 \
    || systemctl start gpasi-redis-enrich.timer >/dev/null 2>&1 || true
}

run_enrich() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  # Pausa catalog/prices só durante o enrich (evita soft-throttle cruzado).
  systemctl stop gpasi-redis-prices.timer gpasi-redis-catalog.timer >/dev/null 2>&1 || true
  systemctl stop gpasi-redis-prices.service gpasi-redis-catalog.service >/dev/null 2>&1 || true

  set +e
  docker run --rm --name "$CONTAINER" \
    --network "$NETWORK" \
    -e REDIS_HOST="${REDIS_HOST:-tecdoc_redis}" \
    -e REDIS_PORT="${REDIS_PORT:-6379}" \
    -e REDIS_PASSWORD \
    -e User_gestao \
    -e Senha_gestao \
    -e ip_gestao \
    -e "ENRICH_BATCH=$BATCH" \
    -v "${OPT_DIR}:${OPT_DIR}:ro" \
    "$IMAGE" \
    python "$SCRIPT" --enrich --enrich-batch "$BATCH"
  local rc=$?
  set -e

  systemctl start gpasi-redis-prices.timer gpasi-redis-catalog.timer >/dev/null 2>&1 || true
  return "$rc"
}

ensure_scripts
heal_timers
ensure_image

log "starting enrich batch=$BATCH image=$IMAGE"
if ! run_enrich; then
  rc=$?
  log "enrich failed rc=$rc — rebuild image + retry once"
  docker build -t "$IMAGE" -f "$DOCKERFILE" "$OPT_DIR" || {
    log "ERROR: rebuild failed"
    exit 1
  }
  if ! run_enrich; then
    rc=$?
    log "ERROR: enrich retry failed rc=$rc"
    # Exit 0 para o timer continuar; o skip/cursor avançam no próximo tick.
    # Só falha hard se a imagem não existir.
    if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
      exit 1
    fi
    exit 0
  fi
fi

log "enrich tick OK"
exit 0
