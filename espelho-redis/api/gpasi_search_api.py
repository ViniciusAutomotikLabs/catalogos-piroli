#!/usr/bin/env python3
"""GPASI Redis + Supabase catalog search API for n8n agent tools.

Endpoints:
  GET /health
  GET /search?q=&viscosidade=&modelo=&catalogo=&fonte=&limit=3
  GET /peca/{codigo}

Cascata com modelo preenchido (sem Supabase automático):
  L0 codigo     — q só código ERP → HGET gpasi:peca:{codigo} (bypass tok)
  L1 strict     — tok ∩ aplic com tokens de MODELO (sem ano/motor)
  L2 soft_aplic — tok + texto aplicacao (modelo principal, anti-moto)
  L3 primary    — relax: só modelo curto (ex s10) se L1/L2 miss
  L4 unscoped   — top candidatos da peça SEM filtro veículo + aviso
  miss          — retry=false só se não houver candidato de peça
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

try:
    import redis
except ImportError as e:  # pragma: no cover
    raise SystemExit("pip install redis fastapi uvicorn") from e

VISCO_RE = re.compile(r"(?<![0-9])(\d{1,2}W\d{2})(?![0-9])", re.I)
TOKEN_RE = re.compile(r"[a-z0-9]{3,}")
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
        "ltz",
        "adv",
        "power",
        "working",
        "flex",
    }
)
MOTO_MARKERS = (
    " moto",
    "moto ",
    "cg 1",
    "cg150",
    "ybr",
    "titan",
    "biz ",
    " fan",
    "pop 1",
    "nxr",
    "factor",
    "fazer",
    "xre",
    "yamaha",
    "honda cg",
    "scooter",
)
MOTO_MODELS = frozenset(
    {"cg", "ybr", "titan", "biz", "fan", "pop", "nxr", "factor", "fazer", "xre", "moto"}
)
# Tokens de modelo que não identificam o veículo sozinhos (motor/combustível/ano).
FUEL_TOKS = frozenset({"diesel", "flex", "gasolina", "alcool", "gnv", "turbo", "aspirado"})
ENGINE_TOK_RE = re.compile(r"^\d+\.\d+$")
YEAR_TOK_RE = re.compile(r"^(19|20)\d{2}$")
ERP_CODE_RE = re.compile(r"^\d{4,8}$")
# Posição (dianteira/traseira): ranking only — NÃO entra no SINTER.
# Catálogo usa muito "DT"/"TR" e texto só em aplicacao ("traseiros"), sem tok:dianteira.
POSITION_TOKS = frozenset(
    {"dianteira", "dianteiro", "traseira", "traseiro", "diant", "tras"}
)
# Tokens de descrição que, se a query for "filtro oleo", não deveriam ranquear alto.
QUERY_PENALTY: dict[str, tuple[str, ...]] = {
    "filtro": ("mangueira", "abracadeira", "abraçadeira", "tubo"),
}

REDIS_HOST = os.environ.get("REDIS_HOST", "tecdoc_redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
SUPABASE_TIMEOUT_S = 2.5

app = FastAPI(title="GPASI Redis Search", version="1.6.0")


def get_redis() -> redis.Redis:
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD or None,
        decode_responses=True,
        socket_timeout=10,
        socket_connect_timeout=5,
    )


def normalize_text(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def tokenize(text: str) -> list[str]:
    norm = normalize_text(text or "")
    out: list[str] = []
    seen: set[str] = set()
    for t in TOKEN_RE.findall(norm):
        if t in STOPWORDS or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def tokenize_vehicle(text: str) -> list[str]:
    norm = normalize_text(text or "")
    out: list[str] = []
    seen: set[str] = set()
    for t in VEHICLE_TOKEN_RE.findall(norm):
        if t in VEHICLE_STOPWORDS or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def peca_dict(codigo: str, raw: dict[str, str], *, compact: bool = False) -> dict[str, Any]:
    row = {
        "codigo": raw.get("codigo") or codigo,
        "descricao": raw.get("descricao") or "",
        "mestre": raw.get("mestre") == "1",
        "viscosidade": raw.get("viscosidade") or "",
        "marca": raw.get("marca") or "",
        "preco": raw.get("preco") or "",
        "precoatacado": raw.get("precoatacado") or "",
        "fonte": "gpasi",
        "vendavel": True,
        "catalogo": None,
        "foto_url": None,
        "referencias": [],
        "codigofabricante": raw.get("codigofabricante") or "",
    }
    aplic = (raw.get("aplicacao") or "")[:160]
    if aplic:
        row["aplicacao"] = aplic
    if compact:
        return row
    row["aplicacao"] = raw.get("aplicacao") or ""
    row["precoecommerce"] = raw.get("precoecommerce") or ""
    row["similarmestre"] = raw.get("similarmestre") or ""
    row["catalog_updated_at"] = raw.get("catalog_updated_at") or ""
    row["price_updated_at"] = raw.get("price_updated_at") or ""
    row["enrich_updated_at"] = raw.get("enrich_updated_at") or ""
    return row


def map_fornecedor(raw: dict[str, Any]) -> dict[str, Any]:
    refs = raw.get("referencias") or []
    if not isinstance(refs, list):
        refs = []
    aplic = str(raw.get("aplicacao") or "")[:160]
    return {
        "fonte": "fornecedor",
        "vendavel": False,
        "codigo": raw.get("codigo") or "",
        "descricao": raw.get("descricao") or "",
        "marca": raw.get("marca") or "",
        "aplicacao": aplic,
        "preco": None,
        "precoatacado": None,
        "catalogo": raw.get("catalogo") or "",
        "foto_url": raw.get("foto_url") or None,
        "referencias": refs[:5],
        "match_tipo": raw.get("match_tipo") or "",
    }


def supabase_ok() -> bool:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return False
    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/catalogos?select=slug&limit=1",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            return 200 <= resp.status < 300
    except Exception:
        return False


def is_moto_blob(text: str) -> bool:
    n = f" {normalize_text(text)} "
    return any(m in n for m in MOTO_MARKERS)


def modelo_is_moto(modelo: str) -> bool:
    toks = tokenize_vehicle(modelo)
    if toks and any(t in MOTO_MODELS for t in toks):
        return True
    # Tokens curtos (cg, xt) caem fora do tokenizer — checa a string crua.
    return is_moto_blob(modelo or "")


def _tok_in_blob(tok: str, blob_n: str) -> bool:
    """Match com fronteira: evita '150' casar dentro de '856051' (part numbers)."""
    return re.search(rf"(?<![a-z0-9]){re.escape(tok)}(?![a-z0-9])", blob_n) is not None


def score_row(
    row: dict[str, Any],
    modelo_n: str,
    *,
    prefer_car: bool,
    q_tokens: list[str] | None = None,
) -> tuple[int, int]:
    blob = normalize_text(
        " ".join(
            [
                str(row.get("descricao") or ""),
                str(row.get("aplicacao") or ""),
                str(row.get("marca") or ""),
                str(row.get("catalogo") or ""),
                str(row.get("codigofabricante") or ""),
            ]
        )
    )
    score = 0
    if row.get("mestre"):
        score += 15
    if row.get("vendavel"):
        score += 40
    if row.get("fonte") == "gpasi":
        score += 30
    if row.get("preco"):
        score += 5
    if modelo_n:
        if modelo_n in blob:
            score += 100
        for t in tokenize_vehicle(modelo_n):
            if t in blob:
                score += 40
    if prefer_car and is_moto_blob(blob):
        score -= 120
    desc = normalize_text(str(row.get("descricao") or ""))
    if desc.startswith("pastilha freio") or desc.startswith("pastilha de freio"):
        score += 35
    elif desc.startswith("pastilha"):
        score += 20
    if any(x in desc for x in ("mola", "pino", "trava", "suporte", "sensor")) and "pastilha" in desc:
        score -= 40
    if desc.startswith("kit ") and "pastilha" in desc:
        score -= 30
    # Ranking: query tokens + anti-mangueira em "filtro oleo"
    q_tokens = q_tokens or []
    for qt in q_tokens:
        if qt in desc:
            score += 12
    if "filtro" in q_tokens and any(t in q_tokens for t in ("oleo", "óleo", "oil")):
        if any(bad in desc for bad in ("mangueira", "abracadeira", "tubo")) and "oleo" not in desc:
            score -= 80
        if "filtro" in desc and "oleo" in desc:
            score += 50
    aplic = normalize_text(str(row.get("aplicacao") or ""))
    want_diant = any(t in q_tokens for t in ("dianteira", "dianteiro", "diant"))
    want_tras = any(t in q_tokens for t in ("traseira", "traseiro", "tras"))
    if want_diant:
        if "traseir" in desc or "traseir" in aplic:
            score -= 120
        if (
            "dianteir" in desc
            or "diant" in desc
            or desc.endswith(" dt")
            or " dt" in f" {desc} "
            or re.search(r"\bdt\b", desc)
        ):
            score += 55
    if want_tras:
        if re.search(r"\bdt\b", desc) or "dianteir" in desc:
            score -= 50
        if "traseir" in desc or "traseir" in aplic or re.search(r"\btr\b", desc):
            score += 45
    return (score, 1 if row.get("mestre") else 0)


def buscar_fornecedor(
    q: str,
    catalogo: str,
    limit: int,
    modelo: str = "",
) -> tuple[list[dict[str, Any]], str | None]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return [], "supabase nao configurado"
    if not (q or "").strip():
        return [], None
    fetch_n = min(5, max(limit * 2, limit))
    termo = q.strip()
    modelo_n = normalize_text(modelo) if modelo else ""
    body = {
        "p_termo": termo,
        "p_catalogo": catalogo.strip() or None,
        "p_limite": fetch_n,
    }
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/buscar_produtos_agente",
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=SUPABASE_TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode() or "[]")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:180]
        if "57014" in detail or "statement timeout" in detail.lower():
            return [], None
        return [], f"supabase http {e.code}: {detail}"
    except TimeoutError:
        return [], None
    except Exception as e:
        msg = str(e)
        if "timed out" in msg.lower() or "timeout" in msg.lower():
            return [], None
        return [], f"supabase erro: {e}"
    if not isinstance(data, list):
        return [], "supabase resposta invalida"
    rows = [map_fornecedor(x) for x in data if isinstance(x, dict)]
    prefer_car = bool(modelo_n) and not modelo_is_moto(modelo)
    ranked = sorted(
        rows,
        key=lambda r: score_row(r, modelo_n, prefer_car=prefer_car),
        reverse=True,
    )
    if prefer_car:
        filtered = [r for r in ranked if score_row(r, modelo_n, prefer_car=True)[0] >= 0]
        if filtered:
            ranked = filtered
        elif modelo_n:
            return [], None
    return ranked[:limit], None


def _sinter_keys(r: redis.Redis, keys: list[str]) -> set[str]:
    if not keys:
        return set()
    if len(keys) == 1:
        return set(r.smembers(keys[0]))
    return set(r.sinter(*keys))


def _primary_vehicle_toks(vehicle_toks: list[str]) -> list[str]:
    """Tokens que identificam o veículo (modelo), excluindo motor/combustível/ano."""
    return [
        t
        for t in vehicle_toks
        if not ENGINE_TOK_RE.match(t) and t not in FUEL_TOKS and not YEAR_TOK_RE.match(t)
    ]


def _model_core_toks(vehicle_toks: list[str]) -> list[str]:
    """Só o modelo do carro (ex.: s10, onix) — sem motor, combustível nem ano."""
    return _primary_vehicle_toks(vehicle_toks)


def _lookup_fab(r: redis.Redis, q: str) -> list[dict[str, Any]]:
    """Resolve código fabricante via índice gpasi:fab:{norm} (se existir)."""
    raw_q = (q or "").strip().upper()
    if not raw_q or " " in raw_q:
        return []
    norms = {raw_q, re.sub(r"[^A-Z0-9]", "", raw_q)}
    codes: list[str] = []
    for n in norms:
        if not n:
            continue
        members = r.smembers(f"gpasi:fab:{n}")
        if members:
            codes.extend(sorted(members))
    if not codes:
        return []
    out: list[dict[str, Any]] = []
    for codigo, raw in _fetch_rows(r, set(codes), cap=50):
        out.append(peca_dict(codigo, raw, compact=True))
    return out


def _lookup_codigo(r: redis.Redis, q: str) -> list[dict[str, Any]]:
    """Resolve código ERP (e zero-pad) direto no hash Redis.

    Não transforma OEM alfanumérico (TH9451, N-559) em dígitos ERP —
    isso gerava falso positivo (TH9451 → 009451 alicate).
    """
    raw_q = (q or "").strip().upper()
    if not raw_q or " " in raw_q:
        return []
    candidates: list[str] = []
    if ERP_CODE_RE.match(raw_q):
        candidates.append(raw_q)
        if len(raw_q) < 6:
            candidates.append(raw_q.zfill(6))
        if len(raw_q) < 8:
            candidates.append(raw_q.zfill(8))
    elif re.fullmatch(r"[A-Z0-9\-]{4,20}", raw_q):
        # Tenta hash literal (raro) + índice fabricante; sem strip de letras.
        candidates.append(raw_q)
        fab_hits = _lookup_fab(r, raw_q)
        if fab_hits:
            return fab_hits

    seen: set[str] = set()
    for codigo in candidates:
        if codigo in seen:
            continue
        seen.add(codigo)
        raw = r.hgetall(f"gpasi:peca:{codigo}")
        if raw:
            return [peca_dict(codigo, raw, compact=True)]
    return []


def _fetch_rows(r: redis.Redis, codes: set[str], cap: int = 800) -> list[tuple[str, dict[str, str]]]:
    code_list = list(codes)[:cap]
    pipe = r.pipeline(transaction=False)
    for codigo in code_list:
        pipe.hgetall(f"gpasi:peca:{codigo}")
    return [(c, raw) for c, raw in zip(code_list, pipe.execute()) if raw]


def _vehicle_ok(
    aplic_raw: str,
    vehicle_toks: list[str],
    primary_toks: list[str],
    prefer_car: bool,
    *,
    require_aplic: bool,
    moto_query: bool = False,
) -> tuple[bool, int]:
    """(passa_validador, qtd_tokens_do_modelo_presentes) no texto de aplicacao."""
    aplic_n = normalize_text(aplic_raw or "")
    if not aplic_n:
        return (not require_aplic), 0
    if prefer_car and is_moto_blob(aplic_n):
        return False, 0
    if moto_query and not is_moto_blob(aplic_n):
        return False, 0
    matched = sum(1 for t in vehicle_toks if _tok_in_blob(t, aplic_n))
    need = primary_toks or vehicle_toks
    if not all(_tok_in_blob(t, aplic_n) for t in need):
        return False, matched
    return True, matched


def _rank_piece_rows(
    rows: list[tuple[str, dict[str, str]]],
    *,
    modelo_n: str,
    prefer_car: bool,
    q_tokens: list[str],
    limit: int,
) -> list[dict[str, Any]]:
    scored: list[tuple[tuple[int, int], dict[str, Any]]] = []
    for codigo, raw in rows:
        row = peca_dict(codigo, raw, compact=True)
        sc = score_row(row, modelo_n, prefer_car=prefer_car, q_tokens=q_tokens)
        if sc[0] <= -50:
            continue
        scored.append((sc, row))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [row for _, row in scored[:limit]]


def search_gpasi(
    r: redis.Redis,
    q: str,
    viscosidade: str,
    modelo: str,
    limit: int,
) -> tuple[list[dict[str, Any]], int, str | None, str]:
    """Retorna (items, total_piece_candidates, miss_hint, layer).

    layer: codigo | "" | strict | soft_aplic | primary | unscoped | miss
    """
    q = (q or "").strip()
    q_tokens = tokenize(q)
    # Posição só no ranking; sinter usa tokens “duros” (peça).
    sinter_tokens = [t for t in q_tokens if t not in POSITION_TOKS] or list(q_tokens)

    # L0 — código ERP / fabricante direto (bypass tok index).
    if q and not viscosidade and " " not in q:
        if ERP_CODE_RE.match(q) or re.fullmatch(r"[A-Za-z0-9\-]{4,20}", q):
            direct = _lookup_codigo(r, q)
            if direct:
                return direct[:limit], 1, None, "codigo"

    codes: set[str] | None = None
    if viscosidade:
        codes = set(r.smembers(f"gpasi:visc:{viscosidade}"))

    if sinter_tokens:
        tok_codes = _sinter_keys(r, [f"gpasi:tok:{t}" for t in sinter_tokens])
        codes = tok_codes if codes is None else (codes & tok_codes)

    if codes is None:
        return [], 0, None, ""

    piece_codes = set(codes)
    piece_count = len(piece_codes)
    vehicle_toks = tokenize_vehicle(modelo) if (modelo or "").strip() else []
    strict = bool(vehicle_toks)

    modelo_n = normalize_text(modelo) if modelo else ""
    prefer_car = bool(modelo_n) and not modelo_is_moto(modelo)
    core_toks = _model_core_toks(vehicle_toks)
    moto_query = modelo_is_moto(modelo)

    miss_hint = (
        "escopo veiculo sem hit no ERP. Confirme modelo/motor/combustivel "
        "ou reformule modelo= (ex: s10 2.8 diesel → s10). "
        "NAO rebuscar com o mesmo modelo. TecDoc no maximo 1 vez. Nunca mensagem vazia."
    )
    unscoped_hint = (
        "hit sem validacao de aplicacao veicular (layer=unscoped). "
        "Mostre nome+codigo+preco e avise que precisa confirmar se serve no veiculo. "
        "NAO chame buscar_peca_catalogo de novo com o mesmo q/modelo."
    )

    def _collect_vehicle(
        need_toks: list[str],
        *,
        use_index: bool,
        require_aplic: bool,
    ) -> list[tuple[int, dict[str, Any]]]:
        items: list[tuple[int, dict[str, Any]]] = []
        if use_index and need_toks:
            vehicle_codes = _sinter_keys(r, [f"gpasi:aplic:{t}" for t in need_toks])
            cand = piece_codes & vehicle_codes
        else:
            cand = piece_codes
        for codigo, raw in _fetch_rows(r, cand):
            row = peca_dict(codigo, raw, compact=True)
            ok, matched = _vehicle_ok(
                raw.get("aplicacao") or "",
                vehicle_toks,
                need_toks,
                prefer_car,
                require_aplic=require_aplic,
                moto_query=moto_query,
            )
            if not ok:
                continue
            sc = score_row(row, modelo_n, prefer_car=prefer_car, q_tokens=q_tokens)
            if sc[0] > -50:
                items.append((matched, row))
        items.sort(
            key=lambda mr: (
                score_row(mr[1], modelo_n, prefer_car=prefer_car, q_tokens=q_tokens),
                mr[0],
            ),
            reverse=True,
        )
        return items

    if not strict:
        ranked = _rank_piece_rows(
            _fetch_rows(r, piece_codes),
            modelo_n=modelo_n,
            prefer_car=prefer_car,
            q_tokens=q_tokens,
            limit=limit,
        )
        return ranked, piece_count, None, ""

    need_l1 = core_toks or vehicle_toks

    # L1 STRICT — aplic index com tokens de MODELO (sem ano).
    l1_items = _collect_vehicle(need_l1, use_index=True, require_aplic=False)
    if l1_items:
        return [row for _, row in l1_items[:limit]], piece_count, None, "strict"

    # L2 soft_aplic
    l2_items = _collect_vehicle(need_l1, use_index=False, require_aplic=True)
    if l2_items:
        return [row for _, row in l2_items[:limit]], piece_count, None, "soft_aplic"

    # L3 primary — só 1º token de modelo (s10).
    if core_toks:
        l3_need = core_toks[:1]
        if l3_need != need_l1:
            l3_items = _collect_vehicle(l3_need, use_index=True, require_aplic=False)
            if not l3_items:
                l3_items = _collect_vehicle(l3_need, use_index=False, require_aplic=True)
            if l3_items:
                return [row for _, row in l3_items[:limit]], piece_count, None, "primary"

    # L4 unscoped — candidatas da peça com preço; agente confirma aplicação.
    if piece_count > 0:
        ranked = _rank_piece_rows(
            _fetch_rows(r, piece_codes),
            modelo_n=modelo_n,
            prefer_car=prefer_car,
            q_tokens=q_tokens,
            limit=limit,
        )
        if ranked:
            return ranked, piece_count, unscoped_hint, "unscoped"

    return [], piece_count, miss_hint, "miss"


@app.get("/health")
def health() -> dict[str, Any]:
    r = get_redis()
    try:
        r.ping()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"redis down: {e}") from e
    sb = supabase_ok()
    return {
        "ok": True,
        "redis": f"{REDIS_HOST}:{REDIS_PORT}",
        "supabase_ok": sb,
        "catalog_updated_at": r.get("gpasi:meta:catalog_updated_at"),
        "catalog_count": r.get("gpasi:meta:catalog_count"),
        "price_updated_at": r.get("gpasi:meta:price_updated_at"),
        "price_count": r.get("gpasi:meta:price_count"),
        "enrich_updated_at": r.get("gpasi:meta:enrich_updated_at"),
        "enrich_count": r.get("gpasi:meta:enrich_count"),
        "aplicacao_coverage": r.get("gpasi:meta:aplicacao_coverage"),
        "aplic_token_count": r.get("gpasi:meta:aplic_token_count"),
    }


@app.get("/peca/{codigo}")
def get_peca(codigo: str) -> dict[str, Any]:
    r = get_redis()
    codigo = codigo.strip()
    raw = r.hgetall(f"gpasi:peca:{codigo}")
    if not raw:
        raise HTTPException(status_code=404, detail="not found")
    return peca_dict(codigo, raw)


@app.get("/search")
def search(
    q: str = Query("", description="texto livre da descrição"),
    viscosidade: str = Query("", description="grau exato ex 5W40"),
    modelo: str = Query("", description="escopo veicular: s10 2.8 diesel"),
    catalogo: str = Query("", description="slug do catálogo Supabase"),
    fonte: str = Query("", description="gpasi | fornecedor | todos"),
    limit: int = Query(3, ge=1, le=5),
) -> JSONResponse:
    r = get_redis()
    viscosidade = (viscosidade or "").strip().upper()
    if viscosidade:
        m = VISCO_RE.search(viscosidade)
        viscosidade = m.group(1).upper() if m else viscosidade.upper()

    fonte_n = (fonte or "").strip().lower()
    if fonte_n not in {"", "gpasi", "fornecedor", "todos"}:
        fonte_n = ""

    if viscosidade:
        fonte_n = "gpasi"

    modelo = (modelo or "").strip()
    strict_vehicle = bool(tokenize_vehicle(modelo))

    want_gpasi = fonte_n in {"", "gpasi", "todos"}
    # STRICT com veículo: nunca Supabase automático.
    want_supa = (fonte_n in {"fornecedor", "todos"} or bool(catalogo.strip())) and not (
        fonte_n == "" and strict_vehicle
    )

    gpasi_items: list[dict[str, Any]] = []
    total_candidates = 0
    miss_hint: str | None = None
    layer = ""
    if want_gpasi:
        gpasi_items, total_candidates, miss_hint, layer = search_gpasi(
            r, q, viscosidade, modelo, limit
        )

    # Fallback fornecedor só sem escopo veicular e ERP sem candidato de peça.
    if (
        fonte_n == ""
        and not catalogo.strip()
        and not viscosidade
        and not strict_vehicle
        and not gpasi_items
        and total_candidates == 0
        and (q or "").strip()
    ):
        want_supa = True

    if fonte_n in {"fornecedor", "todos"} or bool(catalogo.strip()):
        want_supa = True

    if fonte_n == "" and gpasi_items:
        want_supa = False

    # Com modelo STRICT, força sem fornecedor mesmo se miss.
    if fonte_n == "" and strict_vehicle:
        want_supa = False

    supa_items: list[dict[str, Any]] = []
    supa_err: str | None = None
    if want_supa:
        supa_items, supa_err = buscar_fornecedor(q, catalogo, limit, modelo=modelo)

    if fonte_n == "todos":
        remain = max(0, limit - len(gpasi_items))
        items = gpasi_items + supa_items[:remain]
    elif fonte_n == "fornecedor" or (catalogo.strip() and fonte_n != "gpasi"):
        items = supa_items[:limit]
    elif want_supa and not gpasi_items:
        items = supa_items[:limit]
    else:
        items = gpasi_items[:limit]

    hint = "fonte=gpasi: pode cotar preco/estoque. fonte=fornecedor: so referencia/foto, sem preco."
    if miss_hint and items and layer == "unscoped":
        hint = miss_hint
    elif miss_hint and not items:
        hint = miss_hint
    elif not items and not (q or "").strip() and not viscosidade:
        hint = "informe q e/ou viscosidade"
    elif supa_err and not items:
        hint = "nao encontrado. NAO busque de novo. Responda o cliente agora."
    elif not items and (q or viscosidade or modelo):
        hint = (
            "nao encontrado. NAO chame esta tool de novo. "
            "TecDoc no maximo 1 vez, depois responda o cliente. Nunca mensagem vazia."
        )
    elif supa_err:
        hint = f"{hint} supabase: {supa_err}"

    # layer sempre (codigo / strict / soft_aplic / primary / unscoped / "")
    return JSONResponse(
        {
            "count": len(items),
            "total_candidates": total_candidates,
            "items": items,
            "status": "hit" if items else "miss",
            "retry": False,
            "strict": strict_vehicle,
            "layer": layer,
            "hint": hint,
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "gpasi_search_api:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8080")),
        reload=False,
    )
