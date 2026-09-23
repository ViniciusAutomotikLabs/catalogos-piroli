#!/usr/bin/env python3
"""Smoke test seguro da GPASI para endpoints de agente n8n (leitura).

Lê credenciais de .env (ip_gestao, User_gestao, Senha_gestao).
Não cria/apaga pedidos nem altera estoque/cadastro.
"""

from __future__ import annotations

import http.client
import json
import ssl
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
RESULTS_JSON = ROOT / "docs" / "gpasi_smoke_results.json"
DEFAULT_BASE = "http://181.191.194.31:54123"
TIMEOUT_S = 120
EMPRESAS_TRY = ("0001", "1", "01", "0002")


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


def sanitize(obj: Any) -> Any:
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            lk = str(k).lower()
            if lk in {"access_token", "password", "authorization", "token"}:
                out[k] = "***"
            else:
                out[k] = sanitize(v)
        return out
    if isinstance(obj, list):
        return [sanitize(x) for x in obj]
    if isinstance(obj, str) and obj.startswith("eyJ") and len(obj) > 40:
        return "***"
    return obj


def truncate(obj: Any, limit: int = 900) -> str:
    text = json.dumps(sanitize(obj), ensure_ascii=False, default=str)
    if len(text) > limit:
        return text[:limit] + "…"
    return text


def request_json(
    method: str,
    base: str,
    path: str,
    *,
    headers: dict[str, str] | None = None,
    body: dict[str, Any] | str | bytes | None = None,
    form: dict[str, str] | None = None,
    timeout: float = TIMEOUT_S,
) -> dict[str, Any]:
    parsed = urllib.parse.urlparse(base)
    host = parsed.hostname or ""
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    full_path = path if path.startswith("/") else f"/{path}"

    hdrs = {k: v for k, v in (headers or {}).items()}
    payload: bytes | None = None
    if form is not None:
        payload = urllib.parse.urlencode(form).encode()
        hdrs.setdefault("Content-Type", "application/x-www-form-urlencoded")
    elif body is not None:
        if isinstance(body, (dict, list)):
            payload = json.dumps(body).encode()
            hdrs.setdefault("Content-Type", "application/json")
        elif isinstance(body, str):
            payload = body.encode()
        else:
            payload = body
    hdrs.setdefault("Accept", "application/json")
    if payload is not None:
        hdrs["Content-Length"] = str(len(payload))

    started = time.perf_counter()
    conn: http.client.HTTPConnection | http.client.HTTPSConnection | None = None
    try:
        if parsed.scheme == "https":
            conn = http.client.HTTPSConnection(
                host, port, timeout=timeout, context=ssl.create_default_context()
            )
        else:
            conn = http.client.HTTPConnection(host, port, timeout=timeout)
        conn.request(method.upper(), full_path, body=payload, headers=hdrs)
        resp = conn.getresponse()
        raw = resp.read()
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        try:
            parsed_body: Any = json.loads(raw.decode("utf-8") or "null")
        except json.JSONDecodeError:
            parsed_body = raw.decode("utf-8", errors="replace")
        return {
            "ok": 200 <= resp.status < 300,
            "status": resp.status,
            "elapsed_ms": elapsed_ms,
            "bytes": len(raw),
            "body": parsed_body,
            "error": None if 200 <= resp.status < 300 else f"HTTP {resp.status}",
        }
    except Exception as e:  # noqa: BLE001
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        return {
            "ok": False,
            "status": None,
            "elapsed_ms": elapsed_ms,
            "bytes": 0,
            "body": None,
            "error": f"{type(e).__name__}: {e}",
        }
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass


def main() -> int:
    env = load_env(ENV_PATH)
    base = (env.get("ip_gestao") or DEFAULT_BASE).rstrip("/")
    user = env.get("User_gestao") or ""
    password = env.get("Senha_gestao") or ""
    if not user or not password:
        print("ERROR: User_gestao / Senha_gestao ausentes no .env", file=sys.stderr)
        return 2

    results: dict[str, Any] = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base,
        "api": "GPASI",
        "version_expected": "4.0.29",
        "scope": "agent_read_only",
        "tests": [],
        "product": None,
        "discovery": [],
        "notes": [],
        "verdict": None,
    }

    def record(
        name: str, method: str, path: str, result: dict[str, Any], **extra: Any
    ) -> None:
        body_for_preview = result["body"]
        # never persist huge ALL payloads in preview beyond truncate
        entry = {
            "name": name,
            "method": method,
            "path": path,
            "status": result["status"],
            "elapsed_ms": result["elapsed_ms"],
            "bytes": result["bytes"],
            "ok": result["ok"],
            "error": result["error"],
            "body_preview": truncate(body_for_preview),
            **extra,
        }
        results["tests"].append(entry)
        print(
            f"[{'OK' if result['ok'] else 'FAIL'}] {method} {path} "
            f"status={result['status']} {result['elapsed_ms']}ms bytes={result['bytes']}"
        )

    # 1) Auth
    auth = request_json(
        "POST",
        base,
        "/token",
        form={"username": user, "password": password, "grant_type": "password"},
    )
    record("auth_token", "POST", "/token", auth)
    if not auth["ok"] or not isinstance(auth["body"], dict) or not auth["body"].get(
        "access_token"
    ):
        results["verdict"] = "bloqueada"
        results["finished_at"] = datetime.now(timezone.utc).isoformat()
        RESULTS_JSON.parent.mkdir(parents=True, exist_ok=True)
        RESULTS_JSON.write_text(
            json.dumps(sanitize(results), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print("Auth falhou — abortando.")
        return 1

    token = auth["body"]["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Empresa
    emp = request_json(
        "GET",
        base,
        "/erpssplus/empresa/status",
        headers=auth_headers,
        body={},
    )
    record("empresa_status", "GET", "/erpssplus/empresa/status", emp)
    empresa_used = "0001"
    if emp["ok"] and isinstance(emp["body"], list) and emp["body"]:
        first = emp["body"][0]
        if isinstance(first, dict) and first.get("codigo"):
            empresa_used = str(first["codigo"])
        results["empresas"] = [
            {
                "codigo": r.get("codigo"),
                "fantasia": r.get("fantasia"),
                "cnpj": r.get("cnpj"),
            }
            for r in emp["body"]
            if isinstance(r, dict)
        ][:10]

    # 2) Discovery — peca/dados (expected empty for this tenant)
    dados = request_json(
        "GET",
        base,
        "/erpssplus/peca/dados",
        headers=auth_headers,
        body={"bloco": 0, "grupo": "0030"},  # LUBRIFICANTES C/ ANP
    )
    record(
        "peca_dados_grupo_lubrificantes",
        "GET",
        "/erpssplus/peca/dados",
        dados,
        filter={"bloco": 0, "grupo": "0030"},
    )
    if dados["ok"] and dados["bytes"] <= 2:
        results["notes"].append(
            "GET /erpssplus/peca/dados retorna [] mesmo com filtros de grupo "
            "(incl. lubrificantes). Sem descrição de produto via API neste usuário — "
            "não foi possível localizar 'Teste Óleo' por nome."
        )

    # grupos auxiliares (confirma taxonomia)
    grupos = request_json(
        "GET",
        base,
        "/erpssplus/peca/grupo/status",
        headers=auth_headers,
        body={},
    )
    record("peca_grupo_status", "GET", "/erpssplus/peca/grupo/status", grupos)
    oleo_grupos = []
    if grupos["ok"] and isinstance(grupos["body"], list):
        for g in grupos["body"]:
            if not isinstance(g, dict):
                continue
            nome = str(g.get("nome") or "").casefold()
            if any(x in nome for x in ("oleo", "óleo", "lubr")):
                oleo_grupos.append(
                    {"codigo": g.get("codigo"), "nome": g.get("nome")}
                )
    results["discovery"].append({"oleo_grupos": oleo_grupos})

    # Descoberta operacional: estoque/ALL (pesado, mas único caminho com dados neste tenant)
    est_all = request_json(
        "GET",
        base,
        "/erpssplus/peca/estoque/atual/ALL",
        headers=auth_headers,
    )
    # Replace body with summary before recording huge payload
    summary_body: Any = est_all["body"]
    codigoerp = None
    product: dict[str, Any] | None = None
    if est_all["ok"] and isinstance(est_all["body"], list):
        rows = [r for r in est_all["body"] if isinstance(r, dict)]
        positive = [
            r for r in rows if float(r.get("estoque") or 0) > 0 and r.get("codigoerp")
        ]
        summary_body = {
            "total": len(rows),
            "com_estoque_positivo": len(positive),
            "amostra_positivos": positive[:5],
        }
        results["discovery"].append(
            {
                "source": "estoque_ALL",
                "total": len(rows),
                "com_estoque_positivo": len(positive),
            }
        )
        if positive:
            chosen = positive[0]
            codigoerp = str(chosen["codigoerp"])
            product = {
                "codigoerp": codigoerp,
                "nome": None,
                "estoque_amostra": chosen.get("estoque"),
                "match": "primeiro_com_estoque_positivo",
                "note": (
                    "SKU escolhido via estoque/ALL (peca/dados vazio; "
                    "sem cadastro de 'Teste Óleo' via API)."
                ),
            }
        elif rows:
            chosen = rows[0]
            codigoerp = str(chosen.get("codigoerp") or "")
            product = {
                "codigoerp": codigoerp,
                "nome": None,
                "estoque_amostra": chosen.get("estoque"),
                "match": "primeiro_do_all",
            }

    # record with summarized body
    est_all_rec = dict(est_all)
    est_all_rec["body"] = summary_body
    record(
        "peca_estoque_all_discovery",
        "GET",
        "/erpssplus/peca/estoque/atual/ALL",
        est_all_rec,
    )
    results["product"] = product

    if not codigoerp:
        results["notes"].append("Não foi possível obter codigoerp para testes pontuais.")
        results["verdict"] = "parcial"
    else:
        print(
            f"SKU selecionado: {codigoerp} "
            f"estoque={product.get('estoque_amostra') if product else '?'} "
            f"match={product.get('match') if product else '?'}"
        )

        # 3) Existência (conhecido instável / 500 neste tenant)
        peca_check = request_json(
            "POST",
            base,
            "/erpssplus/peca",
            headers=auth_headers,
            body={
                "veiculo": "",
                "peca": "OLEO",
                "codfabricante": "",
                "codbarra": "",
                "pessoa": "1",
            },
        )
        record("peca_existencia", "POST", "/erpssplus/peca", peca_check)
        if not peca_check["ok"]:
            results["notes"].append(
                "POST /erpssplus/peca (verificar existência) retornou erro — "
                "não usar no agente até o fornecedor corrigir."
            )

        code_q = urllib.parse.quote(codigoerp, safe="")

        # 4) Preço pontual
        preco = request_json(
            "GET",
            base,
            f"/erpssplus/peca/preco/{code_q}",
            headers=auth_headers,
        )
        record("peca_preco", "GET", "/erpssplus/peca/preco/{codigoerp}", preco)

        # 5) Estoque v1
        est_v1 = request_json(
            "GET",
            base,
            f"/erpssplus/peca/estoque/atual/{code_q}",
            headers=auth_headers,
        )
        record(
            "peca_estoque_v1",
            "GET",
            "/erpssplus/peca/estoque/atual/{codigoerp}",
            est_v1,
        )

        # 6) Estoque v2
        est_v2 = request_json(
            "GET",
            base,
            f"/erpssplus/v2/peca/estoque/atual/{code_q}",
            headers=auth_headers,
        )
        record(
            "peca_estoque_v2",
            "GET",
            "/erpssplus/v2/peca/estoque/atual/{codigoerp}",
            est_v2,
        )

        # 7) Batch
        batch = request_json(
            "POST",
            base,
            "/erpssplus/peca/estoque/atual/",
            headers=auth_headers,
            body={"codigoerp": [codigoerp], "empresa": empresa_used},
        )
        record(
            "peca_estoque_batch",
            "POST",
            "/erpssplus/peca/estoque/atual/",
            batch,
            empresa_used=empresa_used,
        )

        # 8) Tabela preço
        tab = request_json(
            "GET",
            base,
            "/erpssplus/peca/tabela/preco/",
            headers=auth_headers,
            body={"bloco": 0, "empresa": empresa_used, "codigoerp": codigoerp},
        )
        record(
            "peca_tabela_preco",
            "GET",
            "/erpssplus/peca/tabela/preco/",
            tab,
            empresa_used=empresa_used,
        )
        if tab["ok"] and tab["bytes"] <= 2:
            results["notes"].append(
                "GET /erpssplus/peca/tabela/preco/ retornou []. "
                "Para preço no agente, preferir GET /erpssplus/peca/preco/{codigoerp}."
            )

        # Aux: marca status (sanity)
        marca = request_json(
            "GET",
            base,
            "/erpssplus/peca/marca/status",
            headers=auth_headers,
            body={},
        )
        # summarize
        marca_rec = dict(marca)
        if marca["ok"] and isinstance(marca["body"], list):
            marca_rec["body"] = {
                "total": len(marca["body"]),
                "amostra": marca["body"][:3],
            }
        record("peca_marca_status", "GET", "/erpssplus/peca/marca/status", marca_rec)

    # Verdict
    by_name = {t["name"]: t for t in results["tests"]}
    auth_ok = bool(by_name.get("auth_token", {}).get("ok"))
    agent_core = ["peca_preco", "peca_estoque_v1", "peca_estoque_v2"]
    core_present = [by_name[n] for n in agent_core if n in by_name]
    core_ok = [t for t in core_present if t["ok"]]

    # meaningful preço/estoque (codigoerp preenchido)
    def meaningful(name: str) -> bool:
        t = by_name.get(name)
        if not t or not t["ok"]:
            return False
        preview = t.get("body_preview") or ""
        return '"codigoerp": ""' not in preview and "codigoerp" in preview

    if not auth_ok:
        results["verdict"] = "bloqueada"
    elif (
        core_present
        and len(core_ok) == len(core_present)
        and meaningful("peca_preco")
        and meaningful("peca_estoque_v1")
    ):
        results["verdict"] = "pronta"
    elif auth_ok and core_ok:
        results["verdict"] = "parcial"
    else:
        results["verdict"] = "parcial" if auth_ok else "bloqueada"

    latencies = [t["elapsed_ms"] for t in results["tests"] if t["elapsed_ms"] is not None]
    results["latency_summary"] = {
        "count": len(latencies),
        "min_ms": min(latencies) if latencies else None,
        "max_ms": max(latencies) if latencies else None,
        "avg_ms": round(sum(latencies) / len(latencies), 1) if latencies else None,
    }
    results["finished_at"] = datetime.now(timezone.utc).isoformat()
    results["username_used"] = user
    results["empresa_used"] = empresa_used

    RESULTS_JSON.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_JSON.write_text(
        json.dumps(sanitize(results), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nVeredito: {results['verdict']}")
    print(f"Resultados: {RESULTS_JSON}")
    return 0 if results["verdict"] in {"pronta", "parcial"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
