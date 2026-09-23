#!/usr/bin/env python3
"""Sync Redis GPASI (gpasi:peca:*) → espelho Postgres estoque_saldos.

Fonte: espelho Redis já alimentado pelos jobs gpasi_redis_sync na VPS.
Respeita organizacoes.sync_legado_ativo (no-op se false).

Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  ORGANIZACAO_ID (default 1)
  REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_USER (opcional)
  BATCH_SIZE (default 200)

Uso:
  python scripts/gpasi_espelho_from_redis.py
  python scripts/gpasi_espelho_from_redis.py --limit 500
  python scripts/gpasi_espelho_from_redis.py --loop --interval 1800
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv() -> None:
    for path in (ROOT / ".env", Path("/opt/gpasi-espelho/.env"), Path("/opt/gpasi-sync/.env")):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def env(*names: str, default: str = "") -> str:
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    return default


def log(msg: str) -> None:
    print(msg, flush=True)


def supabase_request(
    method: str,
    path: str,
    *,
    body: Any | None = None,
    params: dict[str, str] | None = None,
    prefer: str | None = None,
) -> Any:
    base = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    if not base or not key:
        raise SystemExit("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
    url = f"{base}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path}: {e.code} {err}") from e


def sync_ligado(organizacao_id: int) -> bool:
    rows = supabase_request(
        "GET",
        "organizacoes",
        params={"id": f"eq.{organizacao_id}", "select": "sync_legado_ativo"},
    )
    if not rows:
        log(f"org {organizacao_id} não encontrada — no-op")
        return False
    return bool(rows[0].get("sync_legado_ativo", True))


def redis_client():
    try:
        import redis
    except ImportError as e:
        raise SystemExit("Instale redis: pip install redis") from e

    host = env("REDIS_HOST", default="tecdoc_redis")
    port = int(env("REDIS_PORT", default="6379") or "6379")
    kwargs: dict[str, Any] = {
        "host": host,
        "port": port,
        "decode_responses": True,
        "socket_connect_timeout": 20,
        "socket_timeout": 60,
    }
    pw = env("REDIS_PASSWORD")
    user = env("REDIS_USER")
    if pw:
        kwargs["password"] = pw
    if user:
        kwargs["username"] = user
    return redis.Redis(**kwargs)


def parse_float(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def upsert_batch(organizacao_id: int, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    payload = [
        {
            "organizacao_id": organizacao_id,
            "codigo": r["codigo"],
            "descricao": r.get("descricao"),
            "quantidade": r.get("quantidade", 0),
            "reservado": 0,
            "preco": r.get("preco", 0),
            "preco_atacado": r.get("preco_atacado"),
        }
        for r in rows
    ]
    supabase_request(
        "POST",
        "rpc/upsert_estoque_espelho",
        body={"p_rows": payload},
    )


def run_once(*, limit: int = 0, batch_size: int = 200) -> int:
    org_id = int(env("ORGANIZACAO_ID", default="1") or "1")
    if not sync_ligado(org_id):
        log(f"sync_legado_ativo=false (org {org_id}) — no-op")
        return 0

    r = redis_client()
    r.ping()
    meta_cat = r.get("gpasi:meta:catalog_count")
    meta_price = r.get("gpasi:meta:price_count")
    meta_at = r.get("gpasi:meta:price_updated_at")
    log(f"Redis ok catalog={meta_cat} prices={meta_price} updated={meta_at}")

    batch: list[dict[str, Any]] = []
    count = 0
    skipped = 0
    cursor = 0
    while True:
        cursor, keys = r.scan(cursor=cursor, match="gpasi:peca:*", count=500)
        if keys:
            pipe = r.pipeline(transaction=False)
            for k in keys:
                pipe.hgetall(k)
            hashes = pipe.execute()
            for h in hashes:
                if not h:
                    continue
                codigo = str(h.get("codigo") or "").strip()
                if not codigo:
                    continue
                preco = parse_float(h.get("preco"))
                if preco is None:
                    skipped += 1
                    continue
                qtd = parse_float(h.get("estoque") or h.get("quantidade") or h.get("qtd")) or 0.0
                batch.append(
                    {
                        "codigo": codigo,
                        "descricao": (h.get("descricao") or None),
                        "quantidade": qtd,
                        "preco": preco,
                        "preco_atacado": parse_float(h.get("precoatacado")),
                    }
                )
                if len(batch) >= batch_size:
                    upsert_batch(org_id, batch)
                    count += len(batch)
                    batch.clear()
                    if count % 2000 == 0:
                        log(f"  upserted {count:,} …")
                    if limit and count >= limit:
                        break
            if limit and count >= limit:
                break
        if cursor == 0:
            break

    if batch and (not limit or count < limit):
        upsert_batch(org_id, batch)
        count += len(batch)

    log(f"Espelho sync ok: {count:,} itens (skipped sem preço={skipped:,}, org={org_id})")
    return count


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Redis GPASI → espelho Postgres")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--batch-size", type=int, default=int(os.environ.get("BATCH_SIZE") or "200"))
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=int, default=1800, help="Segundos entre ciclos")
    args = parser.parse_args()

    if not args.loop:
        run_once(limit=args.limit, batch_size=args.batch_size)
        return 0

    log(f"Loop ativo a cada {args.interval}s (Ctrl+C para parar)")
    while True:
        try:
            run_once(limit=args.limit, batch_size=args.batch_size)
        except Exception as exc:  # noqa: BLE001
            log(f"ERRO no ciclo: {exc}")
        time.sleep(max(60, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
