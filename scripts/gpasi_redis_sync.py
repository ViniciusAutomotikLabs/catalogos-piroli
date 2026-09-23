#!/usr/bin/env python3
"""Sync GPASI catalog + prices + enrich into Redis (prefix gpasi:).

Modes:
  --catalog  GET /peca/similar/status similarmestre="" → hashes + token/visc indexes
  --prices   GET /peca/preco/ALL → update price fields on existing hashes
  --enrich   GET /peca/dados blocos → aplicacao/marca/… + gpasi:aplic:* index
  --full     catalog then prices (enrich fica no timer diário)

Env (from .env or environment):
  ip_gestao / GPASI_BASE, User_gestao, Senha_gestao
  REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
VISCO_RE = re.compile(r"(?<![0-9])(\d{1,2}W\d{2})(?![0-9])", re.I)
TOKEN_RE = re.compile(r"[a-z0-9]{3,}")
# Motor 2.8 etc. + tokens alfanuméricos ≥3 (vehicle index).
VEHICLE_TOKEN_RE = re.compile(r"\d+\.\d+|[a-z0-9]{3,}")
STOPWORDS = frozenset(
    {
        "para",
        "com",
        "sem",
        "the",
        "and",
        "de",
        "da",
        "do",
        "das",
        "dos",
        "em",
        "um",
        "uma",
        "kit",
        "par",
        "pcs",
        "und",
        "uni",
    }
)
# Fora do índice veicular: posição/lixo da string de aplicação.
VEHICLE_STOPWORDS = STOPWORDS | frozenset(
    {
        "todos",
        "todas",
        "posicao",
        "posição",
        "dianteira",
        "dianteiro",
        "traseira",
        "traseiro",
        "superior",
        "inferior",
        "esquerdo",
        "direito",
        "lado",
        "ano",
        "anos",
        "ate",
        "até",
        "apos",
        "após",
        "exceto",
        "inclusive",
        "veiculo",
        "veículo",
        "aplicacao",
        "aplicação",
    }
)
PIPE_CHUNK = 500
CAP_APLICACAO = 2000
CAP_PESQUISA = 200
CAP_DADOS = 1000


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line and "=" not in line.split(":", 1)[0]:
            key, val = line.split(":", 1)
            env[key.strip()] = val.strip()
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip().strip('"').strip("'")
    return env


def resolve_config() -> dict[str, Any]:
    file_env = load_env(ROOT / ".env")
    # also allow /opt/gpasi-sync/.env on VPS
    opt_env = load_env(Path("/opt/gpasi-sync/.env"))
    merged = {**file_env, **opt_env, **{k: v for k, v in os.environ.items() if v}}

    base = (
        merged.get("GPASI_BASE")
        or merged.get("ip_gestao")
        or "http://181.191.194.31:54123"
    ).rstrip("/")
    return {
        "base": base,
        "user": merged.get("User_gestao") or merged.get("GPASI_USER") or "",
        "password": merged.get("Senha_gestao") or merged.get("GPASI_PASSWORD") or "",
        "redis_host": merged.get("REDIS_HOST") or "tecdoc_redis",
        "redis_port": int(merged.get("REDIS_PORT") or "6379"),
        "redis_password": merged.get("REDIS_PASSWORD") or "",
    }


def log(msg: str) -> None:
    print(f"{datetime.now(timezone.utc).strftime('%H:%M:%S')} {msg}", flush=True)


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: dict[str, Any] | None = None,
    form: dict[str, str] | None = None,
    timeout: float = 180,
) -> Any:
    hdrs = dict(headers or {})
    payload: bytes | None = None
    if form is not None:
        payload = urllib.parse.urlencode(form).encode()
        hdrs.setdefault("Content-Type", "application/x-www-form-urlencoded")
    elif body is not None:
        payload = json.dumps(body).encode()
        hdrs.setdefault("Content-Type", "application/json")
    hdrs.setdefault("Accept", "application/json")
    req = urllib.request.Request(url, data=payload, headers=hdrs, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {e.code} {url}: {detail}") from e
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def gpasi_token(cfg: dict[str, Any]) -> str:
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
    return str(token)


def normalize_text(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def extract_viscosidade(descricao: str) -> str:
    m = VISCO_RE.search(descricao or "")
    return m.group(1).upper() if m else ""


def tokenize(descricao: str) -> list[str]:
    norm = normalize_text(descricao or "")
    tokens = TOKEN_RE.findall(norm)
    out: list[str] = []
    seen: set[str] = set()
    for t in tokens:
        if t in STOPWORDS or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def tokenize_vehicle(text: str) -> list[str]:
    """Tokens de escopo veicular (s10, 2.8, diesel). Preserva motor \\d+.\\d+."""
    norm = normalize_text(text or "")
    out: list[str] = []
    seen: set[str] = set()
    for t in VEHICLE_TOKEN_RE.findall(norm):
        if t in VEHICLE_STOPWORDS or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def _clip(val: Any, cap: int) -> str:
    s = str(val or "").strip()
    if len(s) > cap:
        return s[:cap]
    return s


def connect_redis(cfg: dict[str, Any]):
    try:
        import redis  # type: ignore
    except ImportError as e:
        raise SystemExit(
            "redis package required: pip install redis"
        ) from e

    client = redis.Redis(
        host=cfg["redis_host"],
        port=cfg["redis_port"],
        password=cfg["redis_password"] or None,
        decode_responses=True,
        socket_timeout=30,
        socket_connect_timeout=15,
    )
    client.ping()
    return client


def sync_catalog(r, cfg: dict[str, Any], token: str) -> int:
    log("fetching catalog similarmestre='' …")
    t0 = time.perf_counter()
    data = http_json(
        "GET",
        f"{cfg['base']}/erpssplus/peca/similar/status",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        body={"similarmestre": ""},
        timeout=180,
    )
    if not isinstance(data, list):
        raise RuntimeError(f"catalog not a list: {type(data)} {str(data)[:200]}")
    log(f"catalog fetched: {len(data):,} items in {time.perf_counter()-t0:.1f}s")

    # Drop old token/viscosity indexes so removed products don't linger.
    log("clearing old gpasi:tok:* and gpasi:visc:* …")
    deleted = 0
    for pattern in ("gpasi:tok:*", "gpasi:visc:*"):
        cursor = 0
        while True:
            cursor, keys = r.scan(cursor=cursor, match=pattern, count=1000)
            if keys:
                deleted += r.delete(*keys)
            if cursor == 0:
                break
    log(f"cleared {deleted} index keys")

    pipe = r.pipeline(transaction=False)
    count = 0
    now = datetime.now(timezone.utc).isoformat()
    for item in data:
        codigo = str(item.get("codigo") or "").strip()
        descricao = str(item.get("descricao") or "").strip()
        if not codigo or not descricao:
            continue
        viscosidade = extract_viscosidade(descricao)
        mestre = "1" if str(item.get("mestre") or "").strip().lower() in {"sim", "1", "true"} else "0"
        key = f"gpasi:peca:{codigo}"
        pipe.hset(
            key,
            mapping={
                "codigo": codigo,
                "descricao": descricao,
                "mestre": mestre,
                "viscosidade": viscosidade,
                "similarmestre": str(item.get("similarmestre") or ""),
                "ranking": str(item.get("ranking") or ""),
                "linha": str(item.get("linha") or ""),
                "catalog_updated_at": now,
            },
        )
        for tok in tokenize(descricao):
            pipe.sadd(f"gpasi:tok:{tok}", codigo)
        if viscosidade:
            pipe.sadd(f"gpasi:visc:{viscosidade}", codigo)
        count += 1
        if count % PIPE_CHUNK == 0:
            pipe.execute()
            pipe = r.pipeline(transaction=False)
            if count % 20000 == 0:
                log(f"  written {count:,} …")
    pipe.execute()
    r.set("gpasi:meta:catalog_updated_at", now)
    r.set("gpasi:meta:catalog_count", str(count))
    log(f"catalog sync done: {count:,} hashes")
    return count


def _price_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for k in ("pecas", "precos", "data", "items", "result"):
            v = payload.get(k)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
        # single object
        if any(k in payload for k in ("codigoerp", "codigo", "preco")):
            return [payload]
    return []


def sync_prices(r, cfg: dict[str, Any], token: str) -> int:
    log("fetching prices ALL …")
    t0 = time.perf_counter()
    data = http_json(
        "GET",
        f"{cfg['base']}/erpssplus/peca/preco/ALL",
        headers={"Authorization": f"Bearer {token}"},
        timeout=180,
    )
    items = _price_items(data)
    log(f"prices fetched: {len(items):,} in {time.perf_counter()-t0:.1f}s")

    pipe = r.pipeline(transaction=False)
    count = 0
    skipped = 0
    now = datetime.now(timezone.utc).isoformat()
    for item in items:
        codigo = str(item.get("codigoerp") or item.get("codigo") or "").strip()
        if not codigo:
            skipped += 1
            continue
        key = f"gpasi:peca:{codigo}"
        # Only update products that exist from catalog sync (or create thin hash)
        mapping = {
            "preco": str(item.get("preco") if item.get("preco") is not None else ""),
            "precoatacado": str(
                item.get("precoatacado") if item.get("precoatacado") is not None else ""
            ),
            "precoecommerce": str(
                item.get("precoecommerce") if item.get("precoecommerce") is not None else ""
            ),
            "price_updated_at": now,
        }
        if "descricao" in item and item.get("descricao"):
            mapping["descricao"] = str(item["descricao"])
        pipe.hset(key, mapping=mapping)
        count += 1
        if count % PIPE_CHUNK == 0:
            pipe.execute()
            pipe = r.pipeline(transaction=False)
            if count % 20000 == 0:
                log(f"  priced {count:,} …")
    pipe.execute()
    r.set("gpasi:meta:price_updated_at", now)
    r.set("gpasi:meta:price_count", str(count))
    log(f"price sync done: {count:,} updated (skipped {skipped})")
    return count


class EmptyDadosBloco(RuntimeError):
    """API returned empty payload (transient flake / rate limit)."""


SKIP_BLOCOs_KEY = "gpasi:meta:enrich_skipped_blocos"
SKIP_EMPTY_KEY = "gpasi:meta:enrich_skip_empty"
SKIP_COOLDOWN_KEY = "gpasi:meta:enrich_skip_cooldown"
SKIP_REASONS_KEY = "gpasi:meta:enrich_skip_reasons"
SKIP_COOLDOWN_S = 6 * 3600


def purge_junk_skip_keys(r) -> int:
    """Remove IDs sem 'grupo:bloco' (ex.: 14, 15) da fila de retry."""
    removed = 0
    for key in list(r.smembers(SKIP_BLOCOs_KEY) or []):
        if ":" not in str(key):
            r.srem(SKIP_BLOCOs_KEY, key)
            removed += 1
    return removed


def _parse_skip_key(key: str) -> tuple[str, int] | None:
    if ":" not in key:
        return None
    gcode, bstr = key.split(":", 1)
    try:
        return gcode, int(bstr)
    except ValueError:
        return None


def sort_skip_keys(keys: list[str]) -> list[str]:
    """Prioriza grupo 0001 (timeouts recuperáveis), depois ordem lexicográfica."""

    def keyfn(k: str) -> tuple[int, str, int]:
        parsed = _parse_skip_key(k)
        if not parsed:
            return (9, k, 0)
        g, b = parsed
        pri = 0 if g == "0001" else 1
        return (pri, g, b)

    return sorted((k for k in keys if _parse_skip_key(k)), key=keyfn)


def _cooldown_active(r, key: str) -> bool:
    raw = r.hget(SKIP_COOLDOWN_KEY, key)
    if not raw:
        return False
    try:
        return time.time() < float(raw)
    except ValueError:
        return False


def _set_cooldown(r, key: str, seconds: int = SKIP_COOLDOWN_S) -> None:
    r.hset(SKIP_COOLDOWN_KEY, mapping={key: str(time.time() + seconds)})


def _clear_cooldown(r, key: str) -> None:
    r.hdel(SKIP_COOLDOWN_KEY, key)


def _is_empty_reason(reason: str) -> bool:
    rl = (reason or "").lower()
    return "0 pecas" in rl or "returned 0" in rl or "empty /peca/dados" in rl


def _dados_bloco(payload: Any) -> dict[str, Any]:
    # Empty list/dict is a common transient GPASI flake — retryable, not fatal shape.
    if payload == [] or payload == {}:
        raise EmptyDadosBloco("empty /peca/dados payload")
    if isinstance(payload, list) and payload and isinstance(payload[0], dict) and "pecas" in payload[0]:
        return payload[0]
    if isinstance(payload, dict) and "pecas" in payload:
        return payload
    raise RuntimeError(f"unexpected /peca/dados shape: {str(payload)[:240]}")


def _clear_aplic_index(r) -> int:
    deleted = 0
    cursor = 0
    while True:
        cursor, keys = r.scan(cursor=cursor, match="gpasi:aplic:*", count=1000)
        if keys:
            deleted += r.delete(*keys)
        if cursor == 0:
            break
    return deleted


def _list_grupos(cfg: dict[str, Any], token: str) -> list[dict[str, str]]:
    raw = http_json(
        "GET",
        f"{cfg['base']}/erpssplus/peca/grupo/status",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        body={},
        timeout=120,
    )
    if not isinstance(raw, list):
        raise RuntimeError(f"unexpected /peca/grupo/status shape: {str(raw)[:200]}")
    out: list[dict[str, str]] = []
    for g in raw:
        if not isinstance(g, dict):
            continue
        codigo = str(g.get("codigo") or "").strip()
        if not codigo:
            continue
        out.append({"codigo": codigo, "nome": str(g.get("nome") or "")})
    out.sort(key=lambda x: x["codigo"])
    return out


def sync_enrich(
    r,
    cfg: dict[str, Any],
    token: str,
    *,
    start_bloco: int | None = None,
    max_blocos: int | None = None,
) -> int:
    """Espelha /peca/dados por grupo+bloco (bloco puro retorna [] neste tenant).

    Merge idempotente: HSET nos campos ricos + SADD em gpasi:aplic:* (sem duplicar).
    Contadores só sobem para peça que ainda não tinha aplicacao/enrich.
    Nunca limpa gpasi:aplic:* no modo grupo (preserva o que já está no Redis).

    Checkpoint: gpasi:meta:enrich_grupo + enrich_grupo_bloco (+ enrich_grupo_idx).
    max_blocos: batch timer — processa até N blocos com dados, depois exit 0.
    """
    batch_mode = max_blocos is not None and max_blocos > 0
    t0 = time.perf_counter()
    now = datetime.now(timezone.utc).isoformat()

    # Ciclo completo → no-op no timer.
    if batch_mode and r.get("gpasi:meta:enrich_mode") == "grupo":
        if r.get("gpasi:meta:enrich_updated_at") and not r.get("gpasi:meta:enrich_grupo"):
            log(f"enrich batch: ciclo grupo completo em {r.get('gpasi:meta:enrich_updated_at')}; no-op")
            return int(r.get("gpasi:meta:enrich_count") or "0")

    log("enrich: listing grupos via /peca/grupo/status …")
    grupos = _list_grupos(cfg, token)
    if not grupos:
        raise RuntimeError("nenhum grupo retornado por /peca/grupo/status")
    r.set("gpasi:meta:enrich_mode", "grupo")
    r.set("gpasi:meta:enrich_grupos_count", str(len(grupos)))
    log(f"enrich: {len(grupos)} grupos")

    # Cursor: migrar do modo bloco-global antigo sem limpar aplic:*.
    cur_grupo = (r.get("gpasi:meta:enrich_grupo") or "").strip()
    cur_bloco = int(r.get("gpasi:meta:enrich_grupo_bloco") or "0")
    cur_idx = int(r.get("gpasi:meta:enrich_grupo_idx") or "-1")

    if cur_idx < 0 or cur_idx >= len(grupos):
        if cur_grupo:
            for i, g in enumerate(grupos):
                if g["codigo"] == cur_grupo:
                    cur_idx = i
                    break
        if cur_idx < 0:
            cur_idx = 0
            cur_grupo = grupos[0]["codigo"]
            cur_bloco = 1
    if cur_bloco < 1:
        cur_bloco = 1
    if not cur_grupo:
        cur_grupo = grupos[cur_idx]["codigo"]

    # --enrich-from N no modo grupo: reinicia do grupo índice 0, bloco N (raro).
    if start_bloco is not None and start_bloco >= 1 and not batch_mode:
        cur_idx = 0
        cur_grupo = grupos[0]["codigo"]
        cur_bloco = start_bloco

    with_aplic = int(r.get("gpasi:meta:aplicacao_coverage") or "0")
    count = int(r.get("gpasi:meta:enrich_count") or "0")
    token_count_est = int(r.get("gpasi:meta:aplic_token_count") or "0")
    log(
        f"enrich: resume grupo={cur_grupo} idx={cur_idx}/{len(grupos)} "
        f"bloco={cur_bloco} count={count:,} aplic_cov={with_aplic:,}"
    )

    token_acquired = time.perf_counter()

    def ensure_token(current: str) -> str:
        nonlocal token_acquired
        if time.perf_counter() - token_acquired > 20 * 3600:
            log("enrich: refreshing GPASI token …")
            current = gpasi_token(cfg)
            token_acquired = time.perf_counter()
        return current

    def fetch_grupo_bloco(
        grupo: str, bloco: int, current_token: str
    ) -> tuple[dict[str, Any], str]:
        nonlocal token_acquired
        last_err: Exception | None = None
        tok = current_token
        # Batch autônomo: 1 tentativa curta; se vazio, o loop PULA e segue.
        max_attempts = 1 if batch_mode else 8
        for attempt in range(1, max_attempts + 1):
            try:
                tok = ensure_token(tok)
                blk = _dados_bloco(
                    http_json(
                        "GET",
                        f"{cfg['base']}/erpssplus/peca/dados",
                        headers={
                            "Authorization": f"Bearer {tok}",
                            "Content-Type": "application/json",
                        },
                        body={"bloco": bloco, "grupo": grupo},
                        timeout=90 if batch_mode else 300,
                    )
                )
                pecas = blk.get("pecas") or []
                if not isinstance(pecas, list) or not pecas:
                    raise EmptyDadosBloco(f"grupo={grupo} bloco={bloco} returned 0 pecas")
                return blk, tok
            except EmptyDadosBloco as e:
                last_err = e
                sleep_s = 8 if batch_mode else min(180, 20 * attempt)
                log(
                    f"enrich: grupo={grupo} bloco={bloco} attempt {attempt}/{max_attempts} "
                    f"EMPTY ({e}); backoff {sleep_s}s"
                )
                tok = gpasi_token(cfg)
                token_acquired = time.perf_counter()
                time.sleep(sleep_s)
            except Exception as e:
                last_err = e
                sleep_s = 8 if batch_mode else min(120, 10 * attempt)
                log(
                    f"enrich: grupo={grupo} bloco={bloco} attempt {attempt}/{max_attempts} "
                    f"FAIL: {e}; backoff {sleep_s}s"
                )
                tok = gpasi_token(cfg)
                token_acquired = time.perf_counter()
                time.sleep(sleep_s)
        raise RuntimeError(f"grupo={grupo} bloco={bloco} failed after retries: {last_err}")

    def mark_skip(grupo: str, bloco: int, reason: str) -> None:
        key = f"{grupo}:{bloco}"
        if _is_empty_reason(reason):
            # Vazio permanente — não reentra na fila de retry (anti-loop).
            r.sadd(SKIP_EMPTY_KEY, key)
            r.srem(SKIP_BLOCOs_KEY, key)
            r.hset(SKIP_REASONS_KEY, mapping={key: f"{now[:19]} EMPTY {reason}"[:200]})
            log(f"enrich: EMPTY-PERMANENT {key} ({reason}) → próximo")
            return
        r.sadd(SKIP_BLOCOs_KEY, key)
        r.hset(SKIP_REASONS_KEY, mapping={key: f"{now[:19]} {reason}"[:200]})
        log(f"enrich: SKIP {key} ({reason}) → próximo")

    def advance_after_skip(grupo: str, idx: int, bloco: int, total: int) -> tuple[int, int]:
        """Avança cursor para o próximo bloco/grupo após skip. Retorna (idx, next_bloco)."""
        nxt = bloco + 1
        if total > 0 and nxt > total:
            idx2 = idx + 1
            if idx2 < len(grupos):
                save_cursor(grupos[idx2]["codigo"], idx2, 1, 0)
                return idx2, 1
            # fim da lista de grupos
            save_cursor(grupo, idx, nxt, total)
            return idx2, 1
        save_cursor(grupo, idx, nxt if total > 0 else max(bloco + 1, 1), total)
        return idx, nxt

    def process_bloco(blk: dict[str, Any], pipe) -> Any:
        """Merge idempotente — não duplica keys; contadores só para campos novos."""
        nonlocal count, with_aplic, token_count_est
        pecas = blk.get("pecas") or []
        if not isinstance(pecas, list):
            return pipe

        codes: list[str] = []
        items: list[dict[str, Any]] = []
        for p in pecas:
            if not isinstance(p, dict):
                continue
            codigo = str(p.get("codigo") or p.get("codigoerp") or "").strip()
            if not codigo:
                continue
            codes.append(codigo)
            items.append(p)

        # Lê estado atual em pipeline (anti double-count / sabe o que já tinha).
        prev_pipe = r.pipeline(transaction=False)
        for codigo in codes:
            prev_pipe.hmget(f"gpasi:peca:{codigo}", "aplicacao", "enrich_updated_at")
        prev_rows = prev_pipe.execute()

        new_enrich = 0
        new_aplic = 0
        for codigo, p, prev in zip(codes, items, prev_rows):
            prev_aplic = (prev[0] or "").strip() if isinstance(prev, (list, tuple)) else ""
            prev_enrich = (prev[1] or "").strip() if isinstance(prev, (list, tuple)) else ""
            aplicacao = _clip(p.get("aplicacao"), CAP_APLICACAO)
            mapping = {
                "aplicacao": aplicacao,
                "marca": _clip(p.get("marca"), 120),
                "codigofabricante": _clip(p.get("codigofabricante"), 80),
                "codigobarras": _clip(p.get("codigobarras"), 80),
                "grupo": _clip(p.get("grupo") or p.get("grupoproduto"), 120),
                "subgrupo": _clip(p.get("subgrupo"), 120),
                "secao": _clip(p.get("secao"), 120),
                "ncm": _clip(p.get("ncm"), 40),
                "dadostecnicos": _clip(p.get("dadostecnicos"), CAP_DADOS),
                "enrich_updated_at": now,
            }
            for i in range(1, 7):
                mapping[f"pesquisa{i}"] = _clip(p.get(f"pesquisa{i}"), CAP_PESQUISA)
            pipe.hset(f"gpasi:peca:{codigo}", mapping=mapping)
            if not prev_enrich:
                count += 1
                new_enrich += 1
            if aplicacao:
                # SADD é idempotente — reaplicar não duplica membros.
                toks = tokenize_vehicle(aplicacao)
                for t in toks:
                    pipe.sadd(f"gpasi:aplic:{t}", codigo)
                if not prev_aplic:
                    with_aplic += 1
                    new_aplic += 1
                    token_count_est += len(toks)
            if (new_enrich + new_aplic) % PIPE_CHUNK == 0:
                pipe.execute()
                pipe = r.pipeline(transaction=False)
        log(f"enrich: merge +{new_enrich} novos enrich, +{new_aplic} novas aplicacoes")
        return pipe

    def save_cursor(grupo: str, idx: int, next_bloco: int, total_in_grupo: int) -> None:
        r.set("gpasi:meta:enrich_grupo", grupo)
        r.set("gpasi:meta:enrich_grupo_idx", str(idx))
        r.set("gpasi:meta:enrich_grupo_bloco", str(next_bloco))
        r.set("gpasi:meta:enrich_grupo_total_blocos", str(total_in_grupo))
        # Compat: espelha next no campo antigo para /health/ops.
        r.set("gpasi:meta:enrich_next_bloco", f"g{grupo}:b{next_bloco}")
        r.set("gpasi:meta:enrich_count", str(count))
        r.set("gpasi:meta:aplicacao_coverage", str(with_aplic))
        r.set("gpasi:meta:aplic_token_count", str(token_count_est))

    pipe = r.pipeline(transaction=False)
    processed = 0
    skipped_this_tick = 0
    # Autônomo: pode pular vários vazios e ainda encher o batch de sucessos.
    max_skips_per_tick = max(30, (max_blocos or 1) * 4) if batch_mode else 10**9
    stopped_early = False
    sleep_between = 2 if batch_mode else 5

    idx = cur_idx
    while idx < len(grupos):
        grupo = grupos[idx]["codigo"]
        nome = grupos[idx].get("nome") or ""
        bloco_start = cur_bloco if idx == cur_idx else 1

        # Reusa totalblocos cacheado do mesmo grupo (evita re-probe caro).
        cached_total = int(r.get("gpasi:meta:enrich_grupo_total_blocos") or "0")
        cached_grupo = (r.get("gpasi:meta:enrich_grupo") or "").strip()
        total_in_grupo = cached_total if (cached_grupo == grupo and cached_total > 0) else 0

        blk0: dict[str, Any] | None = None
        if total_in_grupo <= 0:
            probe_bloco = bloco_start if bloco_start >= 1 else 1
            try:
                blk0, token = fetch_grupo_bloco(grupo, probe_bloco, token)
            except Exception as e:
                if batch_mode:
                    # PULA e segue (não trava o cron no mesmo bloco).
                    mark_skip(grupo, probe_bloco, str(e)[:120])
                    skipped_this_tick += 1
                    if probe_bloco <= 1:
                        # Sem totalblocos: pula o grupo inteiro.
                        r.sadd("gpasi:meta:enrich_skipped_grupos", grupo)
                        idx += 1
                        cur_bloco = 1
                        cur_idx = idx
                        if idx >= len(grupos):
                            break
                        save_cursor(grupos[idx]["codigo"], idx, 1, 0)
                    else:
                        # total desconhecido: avança 1 bloco e tenta de novo no tick
                        idx, cur_bloco = advance_after_skip(grupo, idx, probe_bloco, 0)
                        cur_idx = idx
                        if idx >= len(grupos):
                            break
                    if skipped_this_tick >= max_skips_per_tick:
                        stopped_early = True
                        break
                    if batch_mode and processed >= max_blocos:
                        stopped_early = True
                        break
                    continue
                raise
            total_in_grupo = int(blk0.get("totalblocos") or 1)
            save_cursor(grupo, idx, bloco_start, total_in_grupo)

        log(
            f"enrich: grupo={grupo} ({nome}) totalblocos={total_in_grupo} "
            f"start_bloco={bloco_start}"
        )

        if blk0 is not None and bloco_start >= 1:
            pipe = process_bloco(blk0, pipe)
            pipe.execute()
            pipe = r.pipeline(transaction=False)
            processed += 1
            # sucesso: remove skip antigo se houver
            r.srem("gpasi:meta:enrich_skipped_blocos", f"{grupo}:{bloco_start}")
            nxt = bloco_start + 1
            save_cursor(grupo, idx, nxt, total_in_grupo)
            log(
                f"enrich: grupo={grupo} bloco {bloco_start}/{total_in_grupo} "
                f"+{len(blk0.get('pecas') or []):,} "
                f"(total enrich={count:,}, aplic={with_aplic:,})"
            )
            if batch_mode and processed >= max_blocos:
                stopped_early = True
                break
            bloco_start = nxt
            if bloco_start <= total_in_grupo:
                time.sleep(sleep_between)

        for bloco in range(bloco_start, total_in_grupo + 1):
            if batch_mode and processed >= max_blocos:
                stopped_early = True
                break
            bt0 = time.perf_counter()
            try:
                blk, token = fetch_grupo_bloco(grupo, bloco, token)
            except Exception as e:
                if batch_mode:
                    mark_skip(grupo, bloco, str(e)[:120])
                    skipped_this_tick += 1
                    old_idx = idx
                    idx, cur_bloco = advance_after_skip(grupo, idx, bloco, total_in_grupo)
                    cur_idx = idx
                    if idx != old_idx:
                        # mudou de grupo — while pega o novo
                        break
                    if skipped_this_tick >= max_skips_per_tick:
                        stopped_early = True
                        break
                    continue
                raise

            pipe = process_bloco(blk, pipe)
            pipe.execute()
            pipe = r.pipeline(transaction=False)
            processed += 1
            r.srem("gpasi:meta:enrich_skipped_blocos", f"{grupo}:{bloco}")
            save_cursor(grupo, idx, bloco + 1, total_in_grupo)
            log(
                f"enrich: grupo={grupo} bloco {bloco}/{total_in_grupo} "
                f"+{len(blk.get('pecas') or []):,} in {time.perf_counter()-bt0:.1f}s "
                f"(total enrich={count:,}, aplic={with_aplic:,})"
            )
            if batch_mode and processed >= max_blocos:
                stopped_early = True
                break
            if bloco < total_in_grupo:
                time.sleep(sleep_between)

        if stopped_early:
            break

        # Próximo grupo (se o for terminou normalmente).
        if idx < len(grupos) and grupos[idx]["codigo"] == grupo:
            idx += 1
            cur_bloco = 1
            cur_idx = idx
            if idx < len(grupos):
                save_cursor(grupos[idx]["codigo"], idx, 1, 0)
                if batch_mode and processed >= max_blocos:
                    stopped_early = True
                    break
            else:
                break
        else:
            # já avançou via skip
            if idx >= len(grupos):
                break
            if batch_mode and processed >= max_blocos:
                stopped_early = True
                break

    pipe.execute()
    r.set("gpasi:meta:enrich_count", str(count))
    r.set("gpasi:meta:aplicacao_coverage", str(with_aplic))
    r.set("gpasi:meta:aplic_token_count", str(token_count_est))
    r.set("gpasi:meta:enrich_skipped_count", str(r.scard(SKIP_BLOCOs_KEY)))

    if stopped_early or idx < len(grupos):
        log(
            f"enrich batch: +{processed} bloco(s), skipped_tick={skipped_this_tick}, "
            f"grupo={r.get('gpasi:meta:enrich_grupo')} "
            f"bloco={r.get('gpasi:meta:enrich_grupo_bloco')}, "
            f"enrich={count:,}, aplic={with_aplic:,} in {time.perf_counter()-t0:.1f}s"
        )
        return count

    # Lista de grupos esgotada — retry skipped (anti-loop empty/cooldown).
    if batch_mode:
        count, with_aplic, token_count_est, still = retry_skipped_blocos(
            r,
            cfg,
            token,
            max_blocos=max_blocos or 10,
            night_mode=False,
            count=count,
            with_aplic=with_aplic,
            token_count_est=token_count_est,
        )
        if still > 0:
            return count

    # Ciclo completo.
    r.set("gpasi:meta:enrich_updated_at", now)
    for k in (
        "gpasi:meta:enrich_grupo",
        "gpasi:meta:enrich_grupo_bloco",
        "gpasi:meta:enrich_grupo_idx",
        "gpasi:meta:enrich_next_bloco",
    ):
        r.delete(k)
    log(
        f"enrich done (modo grupo): {count:,} hashes enriquecidos, "
        f"aplicacao={with_aplic:,}, aplic_token_ops≈{token_count_est:,} "
        f"in {time.perf_counter()-t0:.1f}s"
    )
    return count


def retry_skipped_blocos(
    r,
    cfg: dict[str, Any],
    token: str,
    *,
    max_blocos: int,
    night_mode: bool,
    count: int,
    with_aplic: int,
    token_count_est: int,
    process_bloco_fn=None,
) -> tuple[int, int, int, int]:
    """Reprocessa fila de skip. Retorna (count, with_aplic, token_count_est, still_queued).

    - empty → enrich_skip_empty (permanente) + remove da fila
    - timeout/erro → cooldown 6h, permanece na fila
    - sucesso → merge + remove + limpa cooldown
    - prioriza 0001:*
    """
    purge_junk_skip_keys(r)
    skipped = sort_skip_keys([str(x) for x in (r.smembers(SKIP_BLOCOs_KEY) or [])])
    # Migra vazios já conhecidos na fila → permanente (uma vez).
    empty_known = {str(x) for x in (r.smembers(SKIP_EMPTY_KEY) or [])}
    for key in list(skipped):
        if key in empty_known:
            r.srem(SKIP_BLOCOs_KEY, key)
    skipped = [k for k in skipped if k not in empty_known]

    if not skipped:
        log("enrich retry: fila vazia (após purge/empty)")
        return count, with_aplic, token_count_est, 0

    mode = "night" if night_mode else "day"
    log(f"enrich retry ({mode}): até {max_blocos} de {len(skipped)} skipped (prio 0001)")

    now = datetime.now(timezone.utc).isoformat()
    token_acquired = time.perf_counter()
    max_attempts = 2 if night_mode else 1
    timeout_s = 180 if night_mode else 90
    retry_done = 0
    pipe = r.pipeline(transaction=False)

    def ensure_token(current: str) -> str:
        nonlocal token_acquired
        if time.perf_counter() - token_acquired > 20 * 3600:
            current = gpasi_token(cfg)
            token_acquired = time.perf_counter()
        return current

    def fetch_one(grupo: str, bloco: int, tok: str) -> tuple[dict[str, Any], str]:
        nonlocal token_acquired
        last_err: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                tok = ensure_token(tok)
                blk = _dados_bloco(
                    http_json(
                        "GET",
                        f"{cfg['base']}/erpssplus/peca/dados",
                        headers={
                            "Authorization": f"Bearer {tok}",
                            "Content-Type": "application/json",
                        },
                        body={"bloco": bloco, "grupo": grupo},
                        timeout=timeout_s,
                    )
                )
                pecas = blk.get("pecas") or []
                if not isinstance(pecas, list) or not pecas:
                    raise EmptyDadosBloco(f"grupo={grupo} bloco={bloco} returned 0 pecas")
                return blk, tok
            except EmptyDadosBloco as e:
                last_err = e
                if attempt >= max_attempts:
                    break
                time.sleep(5)
                tok = gpasi_token(cfg)
                token_acquired = time.perf_counter()
            except Exception as e:
                last_err = e
                if attempt >= max_attempts:
                    break
                time.sleep(8)
                tok = gpasi_token(cfg)
                token_acquired = time.perf_counter()
        raise RuntimeError(str(last_err))

    # process_bloco_fn opcional: night mode traz merge próprio
    def default_merge(blk: dict[str, Any], pipe_in):
        nonlocal count, with_aplic, token_count_est
        pecas = blk.get("pecas") or []
        if not isinstance(pecas, list):
            return pipe_in
        codes: list[str] = []
        items: list[dict[str, Any]] = []
        for p in pecas:
            if not isinstance(p, dict):
                continue
            codigo = str(p.get("codigo") or p.get("codigoerp") or "").strip()
            if not codigo:
                continue
            codes.append(codigo)
            items.append(p)
        prev_pipe = r.pipeline(transaction=False)
        for codigo in codes:
            prev_pipe.hmget(f"gpasi:peca:{codigo}", "aplicacao", "enrich_updated_at")
        prev_rows = prev_pipe.execute()
        new_enrich = 0
        new_aplic = 0
        for codigo, p, prev in zip(codes, items, prev_rows):
            prev_aplic = (prev[0] or "").strip() if isinstance(prev, (list, tuple)) else ""
            prev_enrich = (prev[1] or "").strip() if isinstance(prev, (list, tuple)) else ""
            aplicacao = _clip(p.get("aplicacao"), CAP_APLICACAO)
            mapping = {
                "aplicacao": aplicacao,
                "marca": _clip(p.get("marca"), 120),
                "codigofabricante": _clip(p.get("codigofabricante"), 80),
                "codigobarras": _clip(p.get("codigobarras"), 80),
                "grupo": _clip(p.get("grupo") or p.get("grupoproduto"), 120),
                "subgrupo": _clip(p.get("subgrupo"), 120),
                "secao": _clip(p.get("secao"), 120),
                "ncm": _clip(p.get("ncm"), 40),
                "dadostecnicos": _clip(p.get("dadostecnicos"), CAP_DADOS),
                "enrich_updated_at": now,
            }
            for i in range(1, 7):
                mapping[f"pesquisa{i}"] = _clip(p.get(f"pesquisa{i}"), CAP_PESQUISA)
            pipe_in.hset(f"gpasi:peca:{codigo}", mapping=mapping)
            if not prev_enrich:
                count += 1
                new_enrich += 1
            if aplicacao:
                for t in tokenize_vehicle(aplicacao):
                    pipe_in.sadd(f"gpasi:aplic:{t}", codigo)
                if not prev_aplic:
                    with_aplic += 1
                    new_aplic += 1
                    token_count_est += len(tokenize_vehicle(aplicacao))
        log(f"enrich: merge +{new_enrich} novos enrich, +{new_aplic} novas aplicacoes")
        return pipe_in

    merge_fn = process_bloco_fn or default_merge

    for key in skipped:
        if retry_done >= max_blocos:
            break
        if r.sismember(SKIP_EMPTY_KEY, key):
            r.srem(SKIP_BLOCOs_KEY, key)
            continue
        if _cooldown_active(r, key):
            log(f"enrich retry: {key} em cooldown → próximo")
            continue
        parsed = _parse_skip_key(key)
        if not parsed:
            r.srem(SKIP_BLOCOs_KEY, key)
            continue
        gcode, bnum = parsed
        try:
            blk, token = fetch_one(gcode, bnum, token)
        except Exception as e:
            reason = str(e)
            if _is_empty_reason(reason) or isinstance(e, EmptyDadosBloco):
                r.sadd(SKIP_EMPTY_KEY, key)
                r.srem(SKIP_BLOCOs_KEY, key)
                r.hset(SKIP_REASONS_KEY, mapping={key: f"{now[:19]} EMPTY {reason}"[:200]})
                log(f"enrich retry: EMPTY-PERMANENT {key}")
            else:
                _set_cooldown(r, key)
                r.hset(SKIP_REASONS_KEY, mapping={key: f"{now[:19]} {reason}"[:200]})
                log(f"enrich retry: {key} falhou → cooldown 6h ({reason[:80]})")
            continue

        pipe = merge_fn(blk, pipe)
        pipe.execute()
        pipe = r.pipeline(transaction=False)
        r.srem(SKIP_BLOCOs_KEY, key)
        _clear_cooldown(r, key)
        retry_done += 1
        log(f"enrich retry OK {key} +{len(blk.get('pecas') or [])}")

    still = int(r.scard(SKIP_BLOCOs_KEY) or 0)
    r.set("gpasi:meta:enrich_count", str(count))
    r.set("gpasi:meta:aplicacao_coverage", str(with_aplic))
    r.set("gpasi:meta:aplic_token_count", str(token_count_est))
    r.set("gpasi:meta:enrich_skipped_count", str(still))
    r.set("gpasi:meta:enrich_skip_empty_count", str(r.scard(SKIP_EMPTY_KEY) or 0))
    log(f"enrich retry ({mode}): +{retry_done} OK; ainda {still} na fila; empty_perm={r.scard(SKIP_EMPTY_KEY)}")
    return count, with_aplic, token_count_est, still


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync GPASI → Redis")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--catalog", action="store_true")
    g.add_argument("--prices", action="store_true")
    g.add_argument("--enrich", action="store_true", help="Nightly /peca/dados mirror + aplic index")
    g.add_argument(
        "--enrich-retry-skips",
        action="store_true",
        help="Only retry skipped blocos (night job; prioritizes 0001)",
    )
    g.add_argument("--full", action="store_true")
    parser.add_argument(
        "--enrich-from",
        type=int,
        default=None,
        help="Force enrich start bloco (default: resume checkpoint or 1)",
    )
    parser.add_argument(
        "--enrich-batch",
        type=int,
        default=None,
        help="Batch mode: process at most N successful blocos then exit 0",
    )
    parser.add_argument(
        "--night",
        action="store_true",
        help="Night profile: longer timeout + 2 attempts on skip retry",
    )
    args = parser.parse_args()

    # Cutover ERP: se ORGANIZACAO_ID + Supabase estiverem configurados e
    # sync_legado_ativo=false, o job Redis também fica no-op (mesma flag da UI).
    org_id = os.environ.get("ORGANIZACAO_ID", "").strip()
    sb_url = os.environ.get("SUPABASE_URL", "").strip()
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if org_id and sb_url and sb_key:
        try:
            q = urllib.parse.urlencode(
                {"id": f"eq.{org_id}", "select": "sync_legado_ativo"}
            )
            req = urllib.request.Request(
                f"{sb_url.rstrip('/')}/rest/v1/organizacoes?{q}",
                headers={
                    "apikey": sb_key,
                    "Authorization": f"Bearer {sb_key}",
                    "Accept": "application/json",
                },
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                rows = json.loads(resp.read().decode("utf-8"))
            if rows and rows[0].get("sync_legado_ativo") is False:
                log(f"sync_legado_ativo=false (org {org_id}) — no-op")
                return 0
        except Exception as exc:  # noqa: BLE001
            log(f"WARN: não deu para ler sync_legado_ativo ({exc}); seguindo sync")

    if (args.enrich or args.enrich_retry_skips) and args.enrich_batch is None:
        env_batch = os.environ.get("ENRICH_BATCH", "10").strip()
        if args.enrich_retry_skips:
            env_batch = os.environ.get("ENRICH_NIGHT_BATCH", "8").strip()
        try:
            args.enrich_batch = max(1, int(env_batch))
        except ValueError:
            args.enrich_batch = 8 if args.enrich_retry_skips else 10
        log(f"enrich batch size={args.enrich_batch}")

    cfg = resolve_config()
    if not cfg["user"] or not cfg["password"]:
        log("ERROR: missing User_gestao / Senha_gestao")
        return 1
    if not cfg["redis_password"]:
        log("WARN: REDIS_PASSWORD empty")

    log(f"redis={cfg['redis_host']}:{cfg['redis_port']} gpasi={cfg['base']}")
    r = connect_redis(cfg)
    token = gpasi_token(cfg)
    log("GPASI token OK")

    t0 = time.perf_counter()
    if args.catalog or args.full:
        sync_catalog(r, cfg, token)
    if args.prices or args.full:
        sync_prices(r, cfg, token)
    if args.enrich_retry_skips:
        night = args.night or os.environ.get("ENRICH_NIGHT", "").strip() in {"1", "true", "yes"}
        count = int(r.get("gpasi:meta:enrich_count") or "0")
        with_aplic = int(r.get("gpasi:meta:aplicacao_coverage") or "0")
        token_count_est = int(r.get("gpasi:meta:aplic_token_count") or "0")
        retry_skipped_blocos(
            r,
            cfg,
            token,
            max_blocos=args.enrich_batch or 8,
            night_mode=night,
            count=count,
            with_aplic=with_aplic,
            token_count_est=token_count_est,
        )
    elif args.enrich:
        sync_enrich(
            r, cfg, token, start_bloco=args.enrich_from, max_blocos=args.enrich_batch
        )
    log(f"finished in {time.perf_counter()-t0:.1f}s")
    log(
        f"meta catalog={r.get('gpasi:meta:catalog_updated_at')} "
        f"count={r.get('gpasi:meta:catalog_count')} "
        f"price={r.get('gpasi:meta:price_updated_at')} "
        f"price_count={r.get('gpasi:meta:price_count')} "
        f"enrich={r.get('gpasi:meta:enrich_updated_at')} "
        f"aplic_cov={r.get('gpasi:meta:aplicacao_coverage')} "
        f"aplic_tok={r.get('gpasi:meta:aplic_token_count')} "
        f"next_bloco={r.get('gpasi:meta:enrich_next_bloco')} "
        f"skipped={r.scard(SKIP_BLOCOs_KEY)} "
        f"skip_empty={r.scard(SKIP_EMPTY_KEY)} "
        f"visc5W40={r.scard('gpasi:visc:5W40')} "
        f"aplic_s10={r.scard('gpasi:aplic:s10')}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
