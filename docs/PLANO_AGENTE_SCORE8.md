# Plano — Agente confiável ≥ 8/10 (LLM local)

**Baseline:** bateria 2026-08-13 → **4,5/10** (`docs/RELATORIO_BATERIATEST_AGENTE_LOCAL.md`)  
**Meta:** mesma bateria (mesmos inputs) ≥ **8/10** no contrato *pedi peça → nome + valor*.  
**Resultado V2 (pós P0):** **8,7/10** — contrato nome+preço **9/9 PASS**.  
**Resultado V3 (16/08, search v1.6 + prompt):** **10,0/10** — `docs/RELATORIO_BATERIATEST_AGENTE_LOCAL_V2.md`.

## Contrato mínimo
Cliente pede peça/código/óleo → agente devolve **descrição + código + preço** (atacado se lojista). Estoque se pedido.

## Fases

### P0 — Search API (agora)
1. Lookup por código ERP / fabricante no `/search` (hash Redis, não só `tok:`)
2. Cascade L3: STRICT miss → intersect só com **modelo primário** (`s10`, não `s10 2016`)
3. Cascade L4 `unscoped`: se ainda miss e há candidatos de peça → top N **sem** veículo + `layer=unscoped` + hint claro (confirme aplicação)
4. Melhorar ranking básico: penalizar tokens irrelevantes (mangueira quando q=filtro oleo)

### P1 — Agente local (prompt/tools)
1. Hit Redis com `preco` → responder nome+valor na hora (não exigir tool de preço)
2. Código → `/search` ou preço/estoque live (já parcialmente feito)
3. `layer=unscoped` → entregar opções + avisar que aplicação não foi validada
4. Menos perguntas em série; 1 clarificação máx antes de buscar

### P2 — Rebateria
Replay dos mesmos 23 inputs → comparar score vs 4.5 → iterar gaps até ≥8

### P3 — Depois (não bloqueia 8/10)
Enrich aplicacao acelerado; tool multi-estoque; TecDoc article_number

## Enrich autônomo (deploy 16/08)
- Timer **10 min**, batch **10** blocos com sucesso
- Falha/`[]`/timeout → **SKIP** + fila `enrich_skipped_blocos` + segue
- Fim do ciclo → reprocessa skipped
- `gpasi_enrich_autonomous.sh` + heal horário (rebuild imagem se sumir)

## Critério de score (≥8)
- Código conhecido → nome+preço (ou estoque se pedido)
- Peça+veículo comum (pastilha S10 / Onix) → ≥1 hit útil com preço
- Óleo viscosidade → hit (já OK)
- Sem veículo → pergunta 1x, não inventa
- Sem TecDoc inventando termo a partir de código ERP
