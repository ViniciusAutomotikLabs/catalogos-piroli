#!/usr/bin/env python3
"""Sync GPASI preços/estoques → espelho Postgres (estoque_saldos).

Auth: OAuth2 POST /token (mesmo fluxo do n8n) via gpasi_common.
Preço: GET /erpssplus/peca/preco/ALL
Estoque: POST /erpssplus/v2/peca/estoque/atual/ em lotes (empresa configurável).

Respeita organizacoes.sync_legado_ativo (no-op se false).

Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  ORGANIZACAO_ID
  UNIDADE_CODIGO / GPASI_EMPRESA (ex. 0001)
  ip_gestao / GPASI_BASE, User_gestao, Senha_gestao
  GPASI_TOKEN_FILE (opcional)

Uso:
  python scripts/gpasi_espelho_sync.py
  python scripts/gpasi_espelho_sync.py --dry-run --limit 100
"""

from __future__ import annotations

import argparse
import json
import os
import sys
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
    log,
    resolve_config,
)

ROOT = Path(__file__).resolve().parents[1]
STOCK_BATCH = 80


def env(*names: str, default: str = "") -> str:
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    return default


def ensure_env_from_gpasi() -> None:
    """Espelha chaves do .env GPASI no os.environ (formato key:value do legado)."""
    cfg = resolve_config()
    os.environ.setdefault("GPASI_BASE", cfg["base"])
    os.environ.setdefault("GPASI_EMPRESA", str(cfg["empresa"]))


def supabase_request(
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
    rows = supabase_request(
        "GET",
        "organizacoes",
        params={
            "id": f"eq.{organizacao_id}",
            "select": "sync_legado_ativo",
        },
    )
    if not rows:
        print(f"Organização {organizacao_id} não encontrada — no-op.", file=sys.stderr)
        return False
    return bool(rows[0].get("sync_legado_ativo", True))


def resolver_unidade_id(organizacao_id: int, codigo: str | None) -> int | None:
    if not codigo:
        return None
    rows = supabase_request(
        "GET",
        "unidades",
        params={
            "organizacao_id": f"eq.{organizacao_id}",
            "codigo": f"eq.{codigo}",
            "select": "id",
            "limit": "1",
        },
    )
    return int(rows[0]["id"]) if rows else None


def upsert_saldo(
    *,
    organizacao_id: int,
    unidade_id: int | None,
    codigo: str,
    descricao: str | None,
    quantidade: float,
    reservado: float,
    preco: float,
    preco_atacado: float | None,
    dry_run: bool,
) -> None:
    row: dict[str, Any] = {
        "organizacao_id": organizacao_id,
        "codigo": codigo,
        "descricao": descricao,
        "quantidade": quantidade,
        "reservado": reservado,
        "preco": preco,
        "preco_atacado": preco_atacado,
        "atualizado_por_sync": True,
    }
    if unidade_id is not None:
        row["unidade_id"] = unidade_id
    if dry_run:
        print(f"DRY {codigo} qtd={quantidade} res={reservado} preco={preco}")
        return
    conflict = "organizacao_id,unidade_id,codigo"
    supabase_request(
        "POST",
        "estoque_saldos",
        body=row,
        prefer="resolution=merge-duplicates,return=minimal",
        params={"on_conflict": conflict},
    )


def fetch_precos(cfg: dict[str, Any], token: str) -> list[dict[str, Any]]:
    data = http_json(
        "GET",
        f"{cfg['base']}/erpssplus/peca/preco/ALL",
        headers=auth_headers(token),
        timeout=300,
    )
    if isinstance(data, dict):
        data = data.get("data") or data.get("items") or data.get("pecas") or []
    if not isinstance(data, list):
        raise RuntimeError(f"Resposta de preço inesperada: {type(data)}")
    return data


def fetch_estoques_batch(
    cfg: dict[str, Any],
    token: str,
    codigos: list[str],
    empresa: str,
) -> dict[str, tuple[float, float]]:
    """POST v2 estoque/atual — retorna codigo → (estoque, reservado)."""
    if not codigos:
        return {}
    data = http_json(
        "POST",
        f"{cfg['base']}/erpssplus/v2/peca/estoque/atual/",
        headers=auth_headers(token),
        body={"codigoerp": codigos, "empresa": [empresa]},
        timeout=120,
    )
    out: dict[str, tuple[float, float]] = {}
    if not isinstance(data, list):
        return out
    for item in data:
        if not isinstance(item, dict):
            continue
        cod = str(item.get("codigoerp") or item.get("codigo") or "").strip()
        if not cod:
            continue
        try:
            q = float(item.get("estoque") or 0)
        except (TypeError, ValueError):
            q = 0.0
        try:
            r = float(item.get("estoquereservado") or 0)
        except (TypeError, ValueError):
            r = 0.0
        out[cod] = (q, r)
    return out


def main() -> int:
    ensure_env_from_gpasi()
    parser = argparse.ArgumentParser(description="Sync GPASI → espelho Postgres")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limita itens (0 = todos do retorno de preço)",
    )
    parser.add_argument(
        "--skip-estoque",
        action="store_true",
        help="Só atualiza preço (não chama estoque v2)",
    )
    args = parser.parse_args()

    org_raw = env("ORGANIZACAO_ID")
    if not org_raw:
        print("ORGANIZACAO_ID obrigatório.", file=sys.stderr)
        return 2
    organizacao_id = int(org_raw)

    if not sync_ligado(organizacao_id):
        print(
            f"sync_legado_ativo=false para org {organizacao_id} — no-op.",
            flush=True,
        )
        return 0

    cfg = resolve_config()
    empresa = str(cfg["empresa"] or "0001")
    unidade_codigo = env("UNIDADE_CODIGO") or empresa
    unidade_id = resolver_unidade_id(organizacao_id, unidade_codigo)

    token = get_bearer(cfg)
    log(f"espelho sync org={organizacao_id} empresa={empresa} unidade_id={unidade_id}")

    precos = fetch_precos(cfg, token)
    if args.limit:
        precos = precos[: args.limit]
    log(f"preços: {len(precos):,} itens")

    codigos = [
        str(item.get("codigo") or item.get("codigoerp") or "").strip()
        for item in precos
    ]
    codigos = [c for c in codigos if c]

    estoque_map: dict[str, tuple[float, float]] = {}
    if not args.skip_estoque:
        for i in range(0, len(codigos), STOCK_BATCH):
            chunk = codigos[i : i + STOCK_BATCH]
            try:
                part = fetch_estoques_batch(cfg, token, chunk, empresa)
                estoque_map.update(part)
            except Exception as exc:  # noqa: BLE001
                log(f"aviso estoque lote {i}: {exc}")
                if "HTTP 401" in str(exc):
                    token = get_bearer(cfg, force=True)
                    try:
                        part = fetch_estoques_batch(cfg, token, chunk, empresa)
                        estoque_map.update(part)
                    except Exception as exc2:  # noqa: BLE001
                        log(f"aviso estoque retry: {exc2}")
            if (i // STOCK_BATCH) % 20 == 0:
                log(f"estoque progress {min(i + STOCK_BATCH, len(codigos))}/{len(codigos)}")
        log(f"estoque: {len(estoque_map):,} códigos com resposta")

    count = 0
    for item in precos:
        codigo = str(item.get("codigo") or item.get("codigoerp") or "").strip()
        if not codigo:
            continue
        try:
            preco = float(item.get("preco") or item.get("precovenda") or 0)
        except (TypeError, ValueError):
            preco = 0.0
        try:
            atacado_raw = item.get("precoatacado") or item.get("preco_atacado")
            preco_atacado = float(atacado_raw) if atacado_raw is not None else None
        except (TypeError, ValueError):
            preco_atacado = None
        descricao = item.get("descricao") or item.get("nome")
        qtd, reservado = estoque_map.get(codigo, (0.0, 0.0))
        upsert_saldo(
            organizacao_id=organizacao_id,
            unidade_id=unidade_id,
            codigo=codigo,
            descricao=str(descricao) if descricao else None,
            quantidade=qtd,
            reservado=reservado,
            preco=preco,
            preco_atacado=preco_atacado,
            dry_run=args.dry_run,
        )
        count += 1

    log(f"Espelho sync ok: {count} itens (org={organizacao_id}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
