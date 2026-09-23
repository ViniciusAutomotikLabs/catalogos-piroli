#!/usr/bin/env python3
"""Enrich gpasi_catalogo Data Table with aplicacao/marca/codigofabricante from GPASI /peca/dados."""

from __future__ import annotations

import concurrent.futures
import http.client
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = (ROOT / ".env").read_text()
N8N_KEY = ENV.split("N8N_API_KEY=")[1].strip().splitlines()[0]
GPASI_USER = ENV.split("User_gestao:")[1].strip().splitlines()[0]
GPASI_PASS = ENV.split("Senha_gestao:")[1].strip().splitlines()[0]
BASE = "https://n8n.autopecas.tech/api/v1"
TABLE = "lGiFKdQjvZdq465F"
VISCO_RE = re.compile(r"(?<![0-9])(\d{1,2}W\d{2})(?![0-9])", re.I)
STATE = Path("/tmp/gpasi_enrich_state.json")
LOG = Path("/tmp/gpasi_enrich.log")


def log(msg: str) -> None:
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def gpasi_token() -> str:
    c = http.client.HTTPConnection("181.191.194.31", 54123, timeout=60)
    body = urllib.parse.urlencode(
        {"username": GPASI_USER, "password": GPASI_PASS, "grant_type": "password"}
    )
    c.request(
        "POST",
        "/token",
        body=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return json.loads(c.getresponse().read())["access_token"]


def fetch_bloco(token: str, bloco: int) -> dict:
    c = http.client.HTTPConnection("181.191.194.31", 54123, timeout=180)
    c.request(
        "GET",
        "/erpssplus/peca/dados",
        body=json.dumps({"bloco": bloco}),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    raw = json.loads(c.getresponse().read())
    if isinstance(raw, list) and raw and isinstance(raw[0], dict) and "pecas" in raw[0]:
        return raw[0]
    if isinstance(raw, dict) and "pecas" in raw:
        return raw
    raise RuntimeError(f"unexpected bloco {bloco}: {str(raw)[:200]}")


def patch_one(p: dict) -> bool:
    codigo = str(p.get("codigo") or "").strip()
    if not codigo:
        return False
    desc = str(p.get("descricao") or "").strip()
    m = VISCO_RE.search(desc)
    data = {
        "aplicacao": str(p.get("aplicacao") or "")[:20000],
        "marca": str(p.get("marca") or ""),
        "codigofabricante": str(p.get("codigofabricante") or ""),
    }
    if m:
        data["viscosidade"] = m.group(1).upper()
    body = {
        "filter": {
            "type": "and",
            "filters": [{"columnName": "codigo", "condition": "eq", "value": codigo}],
        },
        "data": data,
    }
    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + f"/data-tables/{TABLE}/rows/update",
        data=payload,
        method="PATCH",
        headers={
            "X-N8N-API-KEY": N8N_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            resp.read()
            return True
    except Exception:
        return False


def main() -> None:
    start = 2
    if STATE.exists():
        try:
            start = max(2, int(json.loads(STATE.read_text()).get("next_bloco", 2)))
        except Exception:
            pass

    token = gpasi_token()
    token_at = time.time()
    log(f"start from bloco {start}")
    for bloco in range(start, 111):
        if time.time() - token_at > 20 * 3600:
            token = gpasi_token()
            token_at = time.time()
        t0 = time.time()
        try:
            blk = fetch_bloco(token, bloco)
        except Exception as e:
            log(f"FETCH FAIL {bloco}: {e}")
            time.sleep(5)
            token = gpasi_token()
            token_at = time.time()
            blk = fetch_bloco(token, bloco)
        pecas = blk.get("pecas") or []
        ok = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
            for success in ex.map(patch_one, pecas, chunksize=25):
                ok += int(bool(success))
        STATE.write_text(
            json.dumps(
                {
                    "next_bloco": bloco + 1,
                    "last": {
                        "bloco": bloco,
                        "ok": ok,
                        "n": len(pecas),
                        "s": round(time.time() - t0, 1),
                    },
                }
            )
        )
        log(f"bloco {bloco}/110 patched {ok}/{len(pecas)} in {time.time() - t0:.1f}s")
    log("DONE")


if __name__ == "__main__":
    main()
