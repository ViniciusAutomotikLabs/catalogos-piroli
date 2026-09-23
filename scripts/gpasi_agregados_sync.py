#!/usr/bin/env python3
"""Importa agregados SS Plus → estoque_agregados (ERP novo).

Fonte: GET /erpssplus/peca/dados  (campo agregados: string[])
  - bloco começa em 1 (bloco 0 = [])
  - ~110 blocos × 1000 SKUs; ~25–60 s/bloco

Uso:
  python scripts/gpasi_agregados_sync.py --dry-run --max-blocos 1
  python scripts/gpasi_agregados_sync.py --max-blocos 5
  python scripts/gpasi_agregados_sync.py            # todos os blocos

Env: ORGANIZACAO_ID, SUPABASE_*, User_gestao/Senha_gestao/ip_gestao
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

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gpasi_common import (  # noqa: E402
    auth_headers,
    get_bearer,
    http_json,
    load_env,
    log,
    resolve_config,
)

CHECKPOINT = Path(__file__).resolve().parents[1] / ".cache" / "gpasi_agregados_checkpoint.json"
UPSERT_CHUNK = 200


def env(*names: str, default: str = "") -> str:
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    # também do .env GPASI (key:value)
    file_env = load_env()
    for n in names:
        if file_env.get(n):
            return file_env[n]
    return default


def supabase(
    method: str,
    path: str,
    *,
    body: Any | None = None,
    params: dict[str, str] | None = None,
    prefer: str | None = None,
) -> Any:
    base = env("SUPABASE_URL").rstrip("/")
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
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path}: {e.code} {err}") from e


def sync_ligado(organizacao_id: int) -> bool:
    rows = supabase(
        "GET",
        "organizacoes",
        params={"id": f"eq.{organizacao_id}", "select": "sync_legado_ativo"},
    )
    if not rows:
        return False
    return bool(rows[0].get("sync_legado_ativo", True))


def extract_pecas(payload: Any) -> tuple[list[dict[str, Any]], int]:
    """Retorna (pecas, totalblocos)."""
    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        if "pecas" in payload[0]:
            total = int(payload[0].get("totalblocos") or 0)
            pecas = payload[0].get("pecas") or []
            return pecas if isinstance(pecas, list) else [], total
        if "codigo" in payload[0]:
            return payload, 0
    if isinstance(payload, dict):
        pecas = payload.get("pecas") or []
        return (pecas if isinstance(pecas, list) else []), int(payload.get("totalblocos") or 0)
    return [], 0


def pairs_from_pecas(pecas: list[dict[str, Any]]) -> list[tuple[str, str, int]]:
    out: list[tuple[str, str, int]] = []
    for p in pecas:
        principal = str(p.get("codigo") or "").strip()
        agr = p.get("agregados")
        if not principal or not isinstance(agr, list) or not agr:
            continue
        ordem = 0
        for raw in agr:
            codigo = str(raw or "").strip()
            if not codigo or codigo == principal:
                continue
            out.append((principal, codigo, ordem))
            ordem += 1
    return out


def upsert_rows(organizacao_id: int, pairs: list[tuple[str, str, int]], *, dry_run: bool) -> int:
    if not pairs:
        return 0
    rows = [
        {
            "organizacao_id": organizacao_id,
            "codigo_principal": a,
            "codigo_agregado": b,
            "quantidade_sugerida": 1,
            "ordem": ordem,
            "ativo": True,
            "fonte": "erp",
        }
        for a, b, ordem in pairs
    ]
    if dry_run:
        for r in rows[:5]:
            log(f"DRY {r['codigo_principal']} → {r['codigo_agregado']}")
        if len(rows) > 5:
            log(f"DRY … +{len(rows) - 5}")
        return len(rows)

    for i in range(0, len(rows), UPSERT_CHUNK):
        chunk = rows[i : i + UPSERT_CHUNK]
        supabase(
            "POST",
            "estoque_agregados",
            body=chunk,
            params={"on_conflict": "organizacao_id,codigo_principal,codigo_agregado"},
            prefer="resolution=merge-duplicates,return=minimal",
        )
    return len(rows)


def load_checkpoint() -> dict[str, Any]:
    if not CHECKPOINT.exists():
        return {"next_bloco": 1}
    try:
        return json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"next_bloco": 1}


def save_checkpoint(data: dict[str, Any]) -> None:
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync agregados SS → estoque_agregados")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max-blocos", type=int, default=0, help="0 = todos")
    parser.add_argument("--from-bloco", type=int, default=0, help="0 = checkpoint/1")
    parser.add_argument("--reset-checkpoint", action="store_true")
    args = parser.parse_args()

    org_raw = env("ORGANIZACAO_ID")
    if not org_raw:
        # fallback loja piloto org 1
        org_raw = "1"
        log("ORGANIZACAO_ID ausente — usando 1")
    organizacao_id = int(org_raw)

    if not sync_ligado(organizacao_id):
        log(f"sync_legado_ativo=false org={organizacao_id} — no-op")
        return 0

    cfg = resolve_config()
    token = get_bearer(cfg)

    if args.reset_checkpoint and CHECKPOINT.exists():
        CHECKPOINT.unlink()
        log("checkpoint resetado")

    ck = load_checkpoint()
    bloco = args.from_bloco or int(ck.get("next_bloco") or 1)
    if bloco < 1:
        bloco = 1

    total_pairs = 0
    total_blocos = int(ck.get("totalblocos") or 0)
    blocos_feitos = 0

    while True:
        if args.max_blocos and blocos_feitos >= args.max_blocos:
            break
        if total_blocos and bloco > total_blocos:
            break

        log(f"bloco {bloco}…")
        t0 = time.perf_counter()
        try:
            payload = http_json(
                "GET",
                f"{cfg['base']}/erpssplus/peca/dados",
                headers=auth_headers(token),
                body={"bloco": bloco},
                timeout=300,
            )
        except Exception as exc:  # noqa: BLE001
            if "HTTP 401" in str(exc):
                token = get_bearer(cfg, force=True)
                payload = http_json(
                    "GET",
                    f"{cfg['base']}/erpssplus/peca/dados",
                    headers=auth_headers(token),
                    body={"bloco": bloco},
                    timeout=300,
                )
            else:
                log(f"FAIL bloco {bloco}: {exc}")
                save_checkpoint(
                    {
                        "next_bloco": bloco,
                        "totalblocos": total_blocos,
                        "error": str(exc)[:300],
                    }
                )
                return 1

        pecas, tb = extract_pecas(payload)
        if tb:
            total_blocos = tb
        elapsed = time.perf_counter() - t0
        pairs = pairs_from_pecas(pecas)
        n = upsert_rows(organizacao_id, pairs, dry_run=args.dry_run)
        total_pairs += n
        blocos_feitos += 1
        log(
            f"bloco {bloco}/{total_blocos or '?'} pecas={len(pecas)} "
            f"pares={n} em {elapsed:.1f}s (acum={total_pairs})"
        )

        bloco += 1
        save_checkpoint(
            {
                "next_bloco": bloco,
                "totalblocos": total_blocos,
                "pairs_acum": total_pairs,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        )

        if not pecas and total_blocos and bloco > total_blocos:
            break
        if not pecas and not total_blocos:
            log("bloco vazio sem totalblocos — encerrando")
            break

    log(f"fim pares_upsert={total_pairs} blocos={blocos_feitos} dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
