#!/usr/bin/env python3
"""Renova o Bearer GPASI (POST /token) e grava em cache local.

Padrão n8n: username/password form-urlencoded → access_token (~24h).
Agende a cada 4h (systemd timer) para manter margem confortável.

Uso:
  python scripts/gpasi_token_refresh.py
  python scripts/gpasi_token_refresh.py --force
  python scripts/gpasi_token_refresh.py --print-token   # só stdout do token (cuidado)

Env: ip_gestao/GPASI_BASE, User_gestao, Senha_gestao, GPASI_TOKEN_FILE
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gpasi_common import (  # noqa: E402
    fetch_token,
    load_cached_token,
    log,
    resolve_config,
    save_token,
    token_valid,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh GPASI OAuth token")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ignora cache e pede token novo",
    )
    parser.add_argument(
        "--print-token",
        action="store_true",
        help="Imprime o access_token no stdout (não use em logs públicos)",
    )
    args = parser.parse_args()

    cfg = resolve_config()
    cached = load_cached_token(cfg)

    if not args.force and token_valid(cached):
        log(
            f"token ainda válido até {cached.get('expires_at')} "
            f"({cfg['token_file']}) — no-op"
        )
        if args.print_token:
            print(cached["access_token"])
        return 0

    payload = fetch_token(cfg)
    path = save_token(cfg, payload)
    log(
        f"token renovado → {path} "
        f"expires_at={payload['expires_at']} user={cfg['user']}"
    )
    if args.print_token:
        print(payload["access_token"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
