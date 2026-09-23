#!/usr/bin/env bash
# Deploy Redis→Postgres espelho sync on VPS (docker + systemd loop).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${VPS_HOST:-31.97.93.135}"
REMOTE_USER="${VPS_USER:-root}"

python3 - <<'PY'
from pathlib import Path
vals={}
for line in Path("/Users/vinicius/Documents/Catalogos-piroli/.env").read_text().splitlines():
    line=line.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    k,v=line.split("=",1)
    vals[k.strip()]=v.strip().strip('"').strip("'")
for k in ("SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","REDIS_PASSWORD"):
    if not vals.get(k):
        raise SystemExit(f"missing {k}")
Path("/tmp/gpasi-espelho.docker.env").write_text(
    "\n".join([
        f"SUPABASE_URL={vals['SUPABASE_URL']}",
        f"SUPABASE_SERVICE_ROLE_KEY={vals['SUPABASE_SERVICE_ROLE_KEY']}",
        f"REDIS_PASSWORD={vals['REDIS_PASSWORD']}",
        "REDIS_HOST=tecdoc_redis",
        "REDIS_PORT=6379",
        "ORGANIZACAO_ID=1",
        "BATCH_SIZE=300",
        "",
    ])
)
print("env ok")
PY

scp -o BatchMode=yes \
  "$ROOT/scripts/gpasi_espelho_from_redis.py" \
  /tmp/gpasi-espelho.docker.env \
  "${REMOTE_USER}@${HOST}:/tmp/"

ssh -o BatchMode=yes "${REMOTE_USER}@${HOST}" bash -s <<'REMOTE'
set -euo pipefail
mkdir -p /opt/gpasi-espelho
mv /tmp/gpasi_espelho_from_redis.py /opt/gpasi-espelho/gpasi_espelho_from_redis.py
mv /tmp/gpasi-espelho.docker.env /opt/gpasi-espelho/docker.env
chmod 600 /opt/gpasi-espelho/docker.env

cat > /etc/systemd/system/gpasi-espelho-sync.service <<'UNIT'
[Unit]
Description=GPASI Redis → Postgres espelho sync (loop)
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=simple
ExecStartPre=-/usr/bin/docker rm -f gpasi-espelho-sync
ExecStart=/usr/bin/docker run --rm --name gpasi-espelho-sync \
  --network easypanel \
  --env-file /opt/gpasi-espelho/docker.env \
  -v /opt/gpasi-espelho:/app:ro \
  -w /app \
  python:3.12-slim \
  bash -lc "pip install -q redis && python gpasi_espelho_from_redis.py --loop --interval 1800"
ExecStop=-/usr/bin/docker stop -t 20 gpasi-espelho-sync
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now gpasi-espelho-sync.service
sleep 3
systemctl is-active gpasi-espelho-sync.service
docker ps --filter name=gpasi-espelho-sync --format '{{.Names}} {{.Status}}'
REMOTE

echo "OK: gpasi-espelho-sync na VPS (loop 30 min)."
