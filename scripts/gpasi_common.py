#!/usr/bin/env python3
"""Helpers compartilhados GPASI (OAuth /token + HTTP).

Credenciais via .env (nunca hardcode):
  ip_gestao / GPASI_BASE
  User_gestao / GPASI_USER
  Senha_gestao / GPASI_PASSWORD
  GPASI_TOKEN_FILE (cache do Bearer; default .cache/gpasi_token.json)
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TOKEN_FILE = ROOT / ".cache" / "gpasi_token.json"
# Token GPASI vive ~24h; renovamos com margem e leitores aceitam cache fresco.
TOKEN_TTL_SECONDS = 23 * 3600
TOKEN_REFRESH_SKEW = 300  # 5 min antes do expires_at ainda renova


def load_env(path: Path | None = None) -> dict[str, str]:
    env: dict[str, str] = {}
    for candidate in (
        path,
        ROOT / ".env",
        Path("/opt/gpasi-sync/.env"),
        Path("/opt/catalogos-piroli/.env"),
    ):
        if candidate is None or not candidate.exists():
            continue
        for raw in candidate.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line and "=" not in line.split(":", 1)[0]:
                key, val = line.split(":", 1)
                env.setdefault(key.strip(), val.strip())
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                env.setdefault(key.strip(), val.strip().strip('"').strip("'"))
    for k, v in os.environ.items():
        if v:
            env[k] = v
    return env


def resolve_config(env: dict[str, str] | None = None) -> dict[str, Any]:
    merged = load_env() if env is None else env
    base = (
        merged.get("GPASI_BASE")
        or merged.get("ip_gestao")
        or "http://181.191.194.31:54123"
    ).rstrip("/")
    token_file = merged.get("GPASI_TOKEN_FILE") or str(DEFAULT_TOKEN_FILE)
    return {
        "base": base,
        "user": merged.get("User_gestao") or merged.get("GPASI_USER") or "",
        "password": merged.get("Senha_gestao") or merged.get("GPASI_PASSWORD") or "",
        "token_file": Path(token_file),
        "empresa": merged.get("GPASI_EMPRESA") or merged.get("UNIDADE_CODIGO") or "0001",
    }


def log(msg: str) -> None:
    print(f"{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')} {msg}", flush=True)


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: Any | None = None,
    form: dict[str, str] | None = None,
    timeout: float = 180,
) -> Any:
    hdrs = dict(headers or {})
    payload: bytes | None = None
    if form is not None:
        payload = urllib.parse.urlencode(form).encode()
        hdrs.setdefault("Content-Type", "application/x-www-form-urlencoded")
    elif body is not None:
        payload = json.dumps(body).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    hdrs.setdefault("Accept", "application/json")
    req = urllib.request.Request(url, data=payload, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"HTTP {e.code} {method} {url}: {detail}") from e
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def fetch_token(cfg: dict[str, Any]) -> dict[str, Any]:
    if not cfg["user"] or not cfg["password"]:
        raise SystemExit("Defina User_gestao/Senha_gestao (ou GPASI_USER/GPASI_PASSWORD).")
    data = http_json(
        "POST",
        f"{cfg['base']}/token",
        form={
            "username": cfg["user"],
            "password": cfg["password"],
            "grant_type": "password",
        },
        timeout=60,
    )
    token = (data or {}).get("access_token")
    if not token:
        raise RuntimeError(f"token missing: {data}")
    now = int(time.time())
    return {
        "access_token": str(token),
        "token_type": str((data or {}).get("token_type") or "bearer"),
        "obtained_at": now,
        "expires_at": now + TOKEN_TTL_SECONDS,
        "base": cfg["base"],
        "username": cfg["user"],
    }


def save_token(cfg: dict[str, Any], payload: dict[str, Any]) -> Path:
    path: Path = cfg["token_file"]
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.chmod(0o600)
    tmp.replace(path)
    return path


def load_cached_token(cfg: dict[str, Any]) -> dict[str, Any] | None:
    path: Path = cfg["token_file"]
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not data.get("access_token"):
        return None
    return data


def token_valid(payload: dict[str, Any] | None, *, skew: int = TOKEN_REFRESH_SKEW) -> bool:
    if not payload:
        return False
    expires = int(payload.get("expires_at") or 0)
    return expires - skew > int(time.time())


def get_bearer(
    cfg: dict[str, Any] | None = None,
    *,
    force: bool = False,
    refresh_if_needed: bool = True,
) -> str:
    """Retorna Bearer pronto para Authorization. Atualiza cache se necessário."""
    cfg = cfg or resolve_config()
    cached = None if force else load_cached_token(cfg)
    if token_valid(cached):
        return str(cached["access_token"])
    if not refresh_if_needed and cached and cached.get("access_token"):
        return str(cached["access_token"])
    payload = fetch_token(cfg)
    save_token(cfg, payload)
    return str(payload["access_token"])


def auth_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
