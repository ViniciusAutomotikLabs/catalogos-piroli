#!/usr/bin/env python3
"""Migra pendências SS Plus → WMS via GPASI (ERP→WMS).

Fluxo (OpenAPI wms):
  1. GET  /wms/peca/erp/wms              — peças ainda não transmitidas
  2. POST /wms/peca/mqtt/push/{codigo}   — envia cada código ao WMS
  3. POST /wms/peca/bash/commit          — confirma lote enviado (opcional)

  Opcional: GET /wms/fornecedor/erp/wms + POST /wms/fornecedor/mqtt/push/{codigo}

Por segurança o default é --dry-run (só lista). Use --execute para empurrar.

Uso:
  python scripts/gpasi_wms_migrate.py --dry-run
  python scripts/gpasi_wms_migrate.py --execute --limit 50
  python scripts/gpasi_wms_migrate.py --execute --sleep 0.05 --commit
  python scripts/gpasi_wms_migrate.py --execute --fornecedores

Checkpoint: .cache/gpasi_wms_checkpoint.json (resume entre execuções).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gpasi_common import (  # noqa: E402
    ROOT,
    auth_headers,
    get_bearer,
    http_json,
    log,
    resolve_config,
)

CHECKPOINT_DEFAULT = ROOT / ".cache" / "gpasi_wms_checkpoint.json"


def load_checkpoint(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"pecas_done": [], "fornecedores_done": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"pecas_done": [], "fornecedores_done": []}
    data.setdefault("pecas_done", [])
    data.setdefault("fornecedores_done", [])
    return data


def save_checkpoint(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Manter só os últimos N códigos feitos (set grande demais em disco)
    for key in ("pecas_done", "fornecedores_done"):
        seq = list(dict.fromkeys(data.get(key) or []))
        data[key] = seq[-50000:]
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def extract_codigo(item: Any) -> str:
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, dict):
        for k in ("codigo", "codigoerp", "codigo_erp", "produto"):
            v = item.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
    return ""


def list_pending_pecas(cfg: dict[str, Any], token: str) -> list[str]:
    data = http_json(
        "GET",
        f"{cfg['base']}/wms/peca/erp/wms",
        headers=auth_headers(token),
        timeout=180,
    )
    if not isinstance(data, list):
        raise RuntimeError(f"peca/erp/wms inesperado: {type(data)} {str(data)[:200]}")
    codes: list[str] = []
    seen: set[str] = set()
    for item in data:
        c = extract_codigo(item)
        if c and c not in seen:
            seen.add(c)
            codes.append(c)
    return codes


def list_pending_fornecedores(cfg: dict[str, Any], token: str) -> list[str]:
    try:
        data = http_json(
            "GET",
            f"{cfg['base']}/wms/fornecedor/erp/wms",
            headers=auth_headers(token),
            timeout=120,
        )
    except RuntimeError as e:
        log(f"fornecedor/erp/wms indisponível: {e}")
        return []
    if not isinstance(data, list):
        log(f"fornecedor/erp/wms formato inesperado: {type(data)}")
        return []
    codes: list[str] = []
    seen: set[str] = set()
    for item in data:
        c = extract_codigo(item)
        if c and c not in seen:
            seen.add(c)
            codes.append(c)
    return codes


def push_peca(cfg: dict[str, Any], token: str, codigo: str) -> None:
    from urllib.parse import quote

    http_json(
        "POST",
        f"{cfg['base']}/wms/peca/mqtt/push/{quote(codigo, safe='')}",
        headers=auth_headers(token),
        body={},
        timeout=60,
    )


def push_fornecedor(cfg: dict[str, Any], token: str, codigo: str) -> None:
    from urllib.parse import quote

    http_json(
        "POST",
        f"{cfg['base']}/wms/fornecedor/mqtt/push/{quote(codigo, safe='')}",
        headers=auth_headers(token),
        body={},
        timeout=60,
    )


def commit_pecas(
    cfg: dict[str, Any],
    token: str,
    codigos: list[str],
    *,
    empresa: str,
) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    body = [
        {
            "empresa": empresa,
            "codigoerp": c,
            "retorno": "True",
            "dtenvio": now,
        }
        for c in codigos
    ]
    http_json(
        "POST",
        f"{cfg['base']}/wms/peca/bash/commit",
        headers=auth_headers(token),
        body=body,
        timeout=120,
    )


def migrate_list(
    *,
    cfg: dict[str, Any],
    token: str,
    pending: list[str],
    done_key: str,
    checkpoint: dict[str, Any],
    checkpoint_path: Path,
    push_fn,
    execute: bool,
    limit: int,
    sleep_s: float,
    commit: bool,
    commit_every: int,
) -> tuple[int, int, int]:
    done_set = set(checkpoint.get(done_key) or [])
    todo = [c for c in pending if c not in done_set]
    if limit > 0:
        todo = todo[:limit]

    log(f"{done_key}: pendentes API={len(pending):,} já feitos={len(done_set):,} nesta run={len(todo):,}")

    ok = fail = skip = 0
    batch_for_commit: list[str] = []

    if not execute:
        for c in todo[:20]:
            log(f"DRY {done_key} would push {c}")
        if len(todo) > 20:
            log(f"DRY … +{len(todo) - 20} omitidos")
        return 0, 0, len(todo)

    for i, codigo in enumerate(todo, 1):
        try:
            push_fn(cfg, token, codigo)
            ok += 1
            checkpoint.setdefault(done_key, []).append(codigo)
            batch_for_commit.append(codigo)
            if i % 25 == 0 or i == len(todo):
                save_checkpoint(checkpoint_path, checkpoint)
                log(f"{done_key}: {i}/{len(todo)} ok={ok} fail={fail}")
            if commit and len(batch_for_commit) >= commit_every:
                try:
                    commit_pecas(
                        cfg,
                        token,
                        batch_for_commit,
                        empresa=str(cfg["empresa"]),
                    )
                    log(f"commit {len(batch_for_commit)} peças")
                except Exception as exc:  # noqa: BLE001
                    log(f"aviso commit: {exc}")
                batch_for_commit = []
        except Exception as exc:  # noqa: BLE001
            fail += 1
            log(f"FAIL {codigo}: {exc}")
            # 401 → renovar token uma vez
            if "HTTP 401" in str(exc):
                token = get_bearer(cfg, force=True)
                try:
                    push_fn(cfg, token, codigo)
                    ok += 1
                    fail -= 1
                    checkpoint.setdefault(done_key, []).append(codigo)
                except Exception as exc2:  # noqa: BLE001
                    log(f"FAIL retry {codigo}: {exc2}")
        if sleep_s > 0:
            time.sleep(sleep_s)

    if commit and batch_for_commit and done_key == "pecas_done":
        try:
            commit_pecas(cfg, token, batch_for_commit, empresa=str(cfg["empresa"]))
            log(f"commit final {len(batch_for_commit)} peças")
        except Exception as exc:  # noqa: BLE001
            log(f"aviso commit final: {exc}")

    save_checkpoint(checkpoint_path, checkpoint)
    return ok, fail, skip


def main() -> int:
    parser = argparse.ArgumentParser(description="Migra SS→WMS via GPASI")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="De fato chama mqtt/push (sem isso = dry-run)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Alias explícito (default)")
    parser.add_argument("--limit", type=int, default=0, help="Máx. itens nesta execução")
    parser.add_argument("--sleep", type=float, default=0.05, help="Pausa entre pushes (s)")
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Após pushes de peça, confirma via /wms/peca/bash/commit",
    )
    parser.add_argument(
        "--commit-every",
        type=int,
        default=100,
        help="Tamanho do lote de commit",
    )
    parser.add_argument(
        "--fornecedores",
        action="store_true",
        help="Também processa fornecedores pendentes",
    )
    parser.add_argument(
        "--only-fornecedores",
        action="store_true",
        help="Só fornecedores (pula peças)",
    )
    parser.add_argument(
        "--reset-checkpoint",
        action="store_true",
        help="Zera checkpoint antes de rodar",
    )
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=CHECKPOINT_DEFAULT,
        help="Arquivo de progresso",
    )
    args = parser.parse_args()
    execute = bool(args.execute) and not args.dry_run

    cfg = resolve_config()
    token = get_bearer(cfg)
    log(f"GPASI {cfg['base']} empresa={cfg['empresa']} execute={execute}")

    if args.reset_checkpoint and args.checkpoint.exists():
        args.checkpoint.unlink()
        log("checkpoint resetado")

    checkpoint = load_checkpoint(args.checkpoint)
    total_ok = total_fail = 0

    if not args.only_fornecedores:
        pecas = list_pending_pecas(cfg, token)
        ok, fail, _ = migrate_list(
            cfg=cfg,
            token=token,
            pending=pecas,
            done_key="pecas_done",
            checkpoint=checkpoint,
            checkpoint_path=args.checkpoint,
            push_fn=push_peca,
            execute=execute,
            limit=args.limit,
            sleep_s=args.sleep,
            commit=args.commit,
            commit_every=max(1, args.commit_every),
        )
        total_ok += ok
        total_fail += fail

    if args.fornecedores or args.only_fornecedores:
        forn = list_pending_fornecedores(cfg, token)
        ok, fail, _ = migrate_list(
            cfg=cfg,
            token=token,
            pending=forn,
            done_key="fornecedores_done",
            checkpoint=checkpoint,
            checkpoint_path=args.checkpoint,
            push_fn=push_fornecedor,
            execute=execute,
            limit=args.limit,
            sleep_s=args.sleep,
            commit=False,
            commit_every=100,
        )
        total_ok += ok
        total_fail += fail

    log(f"fim ok={total_ok} fail={total_fail} execute={execute}")
    return 1 if total_fail and execute else 0


if __name__ == "__main__":
    raise SystemExit(main())
