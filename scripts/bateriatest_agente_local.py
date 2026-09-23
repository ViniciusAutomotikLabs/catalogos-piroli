#!/usr/bin/env python3
"""Bateria de testes do Agente com LLM local via chat webhook n8n.

Uso:
  python scripts/bateriatest_agente_local.py
  python scripts/bateriatest_agente_local.py --limit 5   # smoke
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env"
CHAT_URL = (
    "https://n8n.autopecas.tech/webhook/"
    "b9dccff4-c259-41d3-9ab2-a951a945e4e0/chat"
)
API = "https://n8n.autopecas.tech/api/v1"
WF_ID = "8V2xfDI88pTQzuJi"
OUT_JSON = ROOT / "docs" / "bateriatest_agente_local_results.json"
OUT_MD = ROOT / "docs" / "RELATORIO_BATERIATEST_AGENTE_LOCAL.md"

SCENARIOS: list[dict] = [
    {
        "persona": "pessoa_normal",
        "id": "A_pastilha_onix",
        "turns": [
            "oi, preciso de uma pastilha de freio pro meu carro",
            "é um Onix 2019",
        ],
    },
    {
        "persona": "pessoa_normal",
        "id": "B_oleo_5w40",
        "turns": ["quero oleo 5W40"],
    },
    {
        "persona": "pessoa_normal",
        "id": "C_bateria_strada",
        "turns": ["bateria 60AH pra Strada"],
    },
    {
        "persona": "pessoa_normal",
        "id": "D_placa",
        "turns": ["consulta a placa PAN0161 e me diga o veiculo"],
    },
    {
        "persona": "lojista",
        "id": "L_codigo_000781",
        "turns": [
            "me passa o codigo 000781, preco e estoque nas lojas 0001 0004 e 0005",
            "tem similar mais barato?",
        ],
    },
    {
        "persona": "lojista",
        "id": "L_filtro_s10",
        "turns": [
            "filtro de oleo S10 2.8 diesel, quero ate 3 opcoes com preco atacado e estoque 0001 e 0004"
        ],
    },
    {
        "persona": "mecanico",
        "id": "M_retentor_ap",
        "turns": [
            "retentor virabrequim dianteiro motor AP 1.8",
            "confirma se serve no Gol G4",
        ],
    },
    {
        "persona": "mecanico",
        "id": "M_pastilha_s10_anti_moto",
        "turns": [
            "pastilha freio dianteira S10 2.8 diesel — nao me traz peca de moto"
        ],
    },
    {
        "persona": "mecanico",
        "id": "M_codigo_th9451",
        "turns": ["TH9451 preco e estoque na 0001"],
    },
    {
        "persona": "edge",
        "id": "E_sem_veiculo",
        "turns": ["pastilha freio"],
    },
    {
        "persona": "edge",
        "id": "E_gibberish",
        "turns": ["asdfqwer zxcv"],
    },
]


def load_key() -> str:
    for line in ENV.read_text().splitlines():
        if line.startswith("N8N_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("N8N_API_KEY missing in .env")


def http_json(method: str, url: str, body: dict | None = None, key: str | None = None, timeout: int = 180):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if key:
        headers["X-N8N-API-KEY"] = key
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw
        return e.code, parsed


def chat(session_id: str, text: str) -> tuple[int, str, float]:
    t0 = time.perf_counter()
    code, res = http_json(
        "POST",
        CHAT_URL,
        {"action": "sendMessage", "sessionId": session_id, "chatInput": text},
        timeout=180,
    )
    elapsed = time.perf_counter() - t0
    if isinstance(res, dict):
        out = res.get("output") or res.get("text") or json.dumps(res, ensure_ascii=False)
    else:
        out = str(res)
    return code, out, elapsed


def list_executions(key: str, limit: int = 50) -> list[dict]:
    code, res = http_json(
        "GET",
        f"{API}/executions?workflowId={WF_ID}&limit={limit}&includeData=false",
        key=key,
    )
    if code != 200 or not isinstance(res, dict):
        return []
    return list(res.get("data") or [])


def get_execution(key: str, exec_id: str) -> dict | None:
    code, res = http_json(
        "GET",
        f"{API}/executions/{exec_id}?includeData=true",
        key=key,
        timeout=120,
    )
    if code != 200 or not isinstance(res, dict):
        return None
    return res


TOOL_NODE_HINTS = (
    "buscar_peca_catalogo",
    "buscar_por_viscosidade",
    "consultar_preco_peca",
    "consultar_estoque_peca",
    "ConsultaPlaca",
    "Consulta TecDoc",
)


def extract_tools(exec_data: dict) -> list[dict]:
    """Best-effort: scan runData node names + agent intermediate steps."""
    found: list[dict] = []
    data = exec_data.get("data") or {}
    result = data.get("resultData") or {}
    run = result.get("runData") or {}
    for node_name, runs in run.items():
        if any(h in node_name for h in TOOL_NODE_HINTS):
            for r in runs or []:
                found.append(
                    {
                        "node": node_name,
                        "start": (r or {}).get("startTime"),
                        "exec": (r or {}).get("executionTime"),
                    }
                )
        # agent steps sometimes embed tool calls in json
        if node_name in ("AI Agent", "Piroli"):
            for r in runs or []:
                try:
                    items = ((r or {}).get("data") or {}).get("main") or []
                    blob = json.dumps(items, ensure_ascii=False)
                except Exception:
                    blob = ""
                for h in TOOL_NODE_HINTS:
                    if h in blob and not any(x["node"] == h for x in found):
                        # count occurrences roughly
                        c = blob.count(h)
                        found.append({"node": h, "from_agent_blob": True, "mentions": c})
    return found


def write_report(results: dict) -> None:
    lines: list[str] = []
    lines.append("# Relatório — Bateria de testes Agente LLM local")
    lines.append("")
    lines.append(f"- **Quando:** {results['started_at']} → {results['finished_at']}")
    lines.append(f"- **Workflow:** `{WF_ID}` (Agente com LLM local)")
    lines.append(f"- **Canal:** chat webhook público `/webhook/.../chat`")
    lines.append(f"- **Sessões:** {results['stats']['sessions']} · **turns:** {results['stats']['turns']}")
    lines.append(f"- **HTTP OK:** {results['stats']['http_ok']} · **falhas:** {results['stats']['http_fail']}")
    lines.append("")
    lines.append("## Veredicto")
    lines.append("")
    lines.append(results.get("verdict") or "_pendente análise_")
    lines.append("")
    lines.append("## Resultados por cenário")
    lines.append("")
    lines.append("| Persona | Cenário | Turns | OK | Latência méd. | Notas |")
    lines.append("|---|---|---:|---:|---:|---|")
    for s in results["scenarios"]:
        lats = [t["elapsed_s"] for t in s["turns"] if t.get("elapsed_s") is not None]
        avg = (sum(lats) / len(lats)) if lats else 0
        oks = sum(1 for t in s["turns"] if t.get("http") == 200)
        note = (s.get("note") or "")[:80]
        lines.append(
            f"| {s['persona']} | {s['id']} | {len(s['turns'])} | {oks}/{len(s['turns'])} | {avg:.1f}s | {note} |"
        )
    lines.append("")
    lines.append("## Comportamento das tools (a partir das execuções)")
    lines.append("")
    for finding in results.get("findings") or []:
        lines.append(f"- {finding}")
    lines.append("")
    lines.append("## Recomendações")
    lines.append("")
    for rec in results.get("recommendations") or []:
        lines.append(f"- {rec}")
    lines.append("")
    lines.append("## Apêndice — sessões")
    lines.append("")
    for s in results["scenarios"]:
        lines.append(f"### `{s['id']}` ({s['persona']}) — session `{s['session_id']}`")
        lines.append("")
        for i, t in enumerate(s["turns"], 1):
            lines.append(f"**U{i}:** {t['user']}")
            lines.append("")
            lines.append(f"**A{i}** ({t.get('elapsed_s', '?')}s, http={t.get('http')}):")
            lines.append("")
            lines.append("```")
            lines.append((t.get("assistant") or "")[:2500])
            lines.append("```")
            lines.append("")
        if s.get("execution_ids"):
            lines.append(f"Executions candidatas: {', '.join(s['execution_ids'])}")
            lines.append("")
        if s.get("tools_seen"):
            lines.append(f"Tools vistas: {s['tools_seen']}")
            lines.append("")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    OUT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


def analyze(results: dict, key: str) -> None:
    findings: list[str] = []
    recs: list[str] = []
    # pull recent executions and attach by time window
    execs = list_executions(key, limit=40)
    detailed: list[dict] = []
    for e in execs[:25]:
        d = get_execution(key, str(e["id"]))
        if d:
            detailed.append(d)
            time.sleep(0.2)

    tool_counter: dict[str, int] = {}
    for d in detailed:
        for t in extract_tools(d):
            name = t["node"]
            tool_counter[name] = tool_counter.get(name, 0) + 1

    if tool_counter:
        findings.append(
            "Contagem aproximada de nós de tool nas execuções recentes: "
            + ", ".join(f"{k}={v}" for k, v in sorted(tool_counter.items()))
        )
    else:
        findings.append(
            "Não foi possível extrair nós de tool do runData (comum se o Agent embute steps). "
            "Julgamento também pelo texto das respostas."
        )

    # heuristic notes from assistant text
    miss_like = 0
    stock_mentioned = 0
    asked_vehicle = 0
    for s in results["scenarios"]:
        tools_guess: list[str] = []
        texts = " ".join((t.get("assistant") or "").lower() for t in s["turns"])
        if "não encontr" in texts or "nao encontr" in texts or "sem hit" in texts or "não localiz" in texts:
            miss_like += 1
            s["note"] = (s.get("note") or "") + "miss/sem hit; "
        if "estoque" in texts:
            stock_mentioned += 1
        if "modelo" in texts or "qual o carro" in texts or "veículo" in texts or "veiculo" in texts:
            asked_vehicle += 1
            s["note"] = (s.get("note") or "") + "pediu veículo; "
        if "placa" in texts or "onix" in texts or "s10" in texts:
            pass
        # attach nearest executions by timestamp if available
        s["tools_seen"] = tools_guess
        s["execution_ids"] = [str(e["id"]) for e in execs[:5]]

    findings.append(f"Cenários com cara de miss/sem peça: {miss_like}")
    findings.append(f"Cenários que mencionam estoque na resposta: {stock_mentioned}")
    findings.append(f"Cenários que pedem/confirmam veículo: {asked_vehicle}")

    # specific known issues
    for s in results["scenarios"]:
        if s["id"] == "C_bateria_strada":
            blob = " ".join(t.get("assistant") or "" for t in s["turns"]).lower()
            if "não" in blob or "nao" in blob or "sem" in blob:
                findings.append(
                    "Bateria 60AH + Strada: resposta vazia/miss esperável enquanto enrich de aplicação estiver parcial "
                    "(peça existe no Redis sem aplicacao)."
                )
                recs.append(
                    "Enquanto enrich < cobertura útil: L2/soft ou modo `peca_sem_aplic` para categorias "
                    "sem vínculo veicular típico (bateria/óleo genérico), ou pedir ao agente relaxar modelo= numa 2ª busca."
                )
        if s["id"] == "E_sem_veiculo":
            blob = " ".join(t.get("assistant") or "" for t in s["turns"]).lower()
            if "carro" in blob or "veículo" in blob or "veiculo" in blob or "modelo" in blob:
                findings.append("Edge sem veículo: agente pediu carro (bom).")
            else:
                findings.append("Edge sem veículo: agente NÃO pediu carro — revisar prompt.")
                recs.append("Reforçar no system prompt: sem modelo (exceto óleo/código) → perguntar veículo antes de buscar.")

    if "consultar_estoque_peca01" not in tool_counter and stock_mentioned:
        findings.append(
            "Respostas falam de estoque, mas nó estoque01/04/05 pouco aparece no runData — "
            "validar se o LLM está inventando estoque ou se o trace não exporta tool nodes."
        )
        recs.append(
            "Nas próximas rodadas, inspecionar execution includeData do AI Agent (intermediateSteps) "
            "e/ou ligar saveExecutionProgress."
        )

    recs.append("Manter bateria via webhook (já público); browser do Cursor só para debug visual pontual.")
    recs.append("Alinhar prompt longo do WA no agente local se o comportamento divergir sob GPT-5-mini/Ollama.")
    recs.append("Continuar enrich grupo×bloco — é o maior gargalo dos misses com modelo=.")

    # verdict
    ok_ratio = results["stats"]["http_ok"] / max(1, results["stats"]["turns"])
    if ok_ratio > 0.9:
        verdict = (
            f"Bateria executada com {ok_ratio:.0%} turns HTTP 200. "
            "Tools do Piroli estão no fluxo local; qualidade das respostas ainda depende da cobertura de `aplicacao` no Redis "
            "e da disciplina do LLM em chamar estoque 01/04/05."
        )
    else:
        verdict = f"Bateria com falhas HTTP ({ok_ratio:.0%} OK) — revisar timeout/LLM/token GPASI."

    results["findings"] = findings
    results["recommendations"] = recs
    results["verdict"] = verdict
    results["tool_counter"] = tool_counter
    results["execution_sample_ids"] = [str(e["id"]) for e in execs[:15]]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="limita nº de cenários (0=todos)")
    args = ap.parse_args()

    key = load_key()
    scenarios = SCENARIOS[: args.limit] if args.limit else SCENARIOS
    started = datetime.now(timezone.utc).isoformat()
    results: dict = {
        "started_at": started,
        "finished_at": None,
        "scenarios": [],
        "stats": {"sessions": 0, "turns": 0, "http_ok": 0, "http_fail": 0},
    }

    print(f"running {len(scenarios)} scenarios…", flush=True)
    for sc in scenarios:
        session_id = f"bat-{sc['id']}-{uuid.uuid4().hex[:8]}"
        entry = {
            "persona": sc["persona"],
            "id": sc["id"],
            "session_id": session_id,
            "turns": [],
            "note": "",
            "execution_ids": [],
            "tools_seen": [],
        }
        print(f"\n=== {sc['id']} session={session_id}", flush=True)
        for msg in sc["turns"]:
            code, out, elapsed = chat(session_id, msg)
            print(f"  U: {msg[:80]}\n  A({elapsed:.1f}s/{code}): {out[:160].replace(chr(10),' ')}", flush=True)
            entry["turns"].append(
                {
                    "user": msg,
                    "assistant": out,
                    "http": code,
                    "elapsed_s": round(elapsed, 2),
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
            )
            results["stats"]["turns"] += 1
            if code == 200:
                results["stats"]["http_ok"] += 1
            else:
                results["stats"]["http_fail"] += 1
            time.sleep(2.5)
        results["stats"]["sessions"] += 1
        results["scenarios"].append(entry)

    results["finished_at"] = datetime.now(timezone.utc).isoformat()
    print("\nanalyzing executions…", flush=True)
    analyze(results, key)
    write_report(results)
    print(f"wrote {OUT_MD}")
    print(f"wrote {OUT_JSON}")
    print(results["verdict"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
