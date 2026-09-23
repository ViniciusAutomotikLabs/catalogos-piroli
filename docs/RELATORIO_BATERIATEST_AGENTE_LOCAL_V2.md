# Relatório V2 — Bateria Agente LLM local (pós P0)

- **Quando:** 2026-08-17T01:46:00.127178+00:00 → 2026-08-17T01:51:46.316903+00:00
- **Baseline:** 4,5/10 (bateria 2026-08-13)
- **Score V2:** **10.0/10**
- **Contrato nome+preço:** 9/9 PASS
- **HTTP:** 23/23
- **Mudanças:** gpasi-search v1.6 (dianteira≠SINTER + L0 OEM seguro) + score OEM miss

## Tabela

| ID | Grade | Pts | Tools | Latência | Nota |
|---|---|---:|---|---:|---|
| A1 | PASS | 1.0 | `—` | 6.02s | clarificacao |
| A2 | PASS | 1.0 | `—` | 5.92s | clarificacao |
| A3 | PASS | 1.0 | `ConsultaPlaca` | 15.9s | placa-conflito |
| A4 | PASS | 1.0 | `buscar_peca_catalogo` | 17.68s | peca+preco |
| B1 | PASS | 1.0 | `buscar_por_viscosidade` | 9.61s | oleo+preco |
| C1 | PASS | 1.0 | `—` | 6.57s | clarificacao |
| C2 | PASS | 1.0 | `buscar_peca_catalogo` | 14.41s | peca+preco |
| L1 | PASS | 1.0 | `buscar_peca_catalogo, consultar_estoque_peca01, consultar_estoque_peca04, consultar_estoque_peca05` | 9.24s | codigo |
| L2 | PASS | 1.0 | `buscar_peca_catalogo` | 21.09s | fallback |
| L3 | PASS | 1.0 | `buscar_peca_catalogo, consultar_estoque_peca01, consultar_estoque_peca04` | 16.08s | peca+preco |
| M1 | PASS | 1.0 | `buscar_peca_catalogo` | 16.47s | peca+preco |
| M2 | PASS | 1.0 | `buscar_peca_catalogo` | 19.2s | peca+preco |
| M3 | PASS | 1.0 | `buscar_peca_catalogo` | 12.84s | peca+preco |
| M3b | PASS | 1.0 | `—` | 8.43s | peca+preco |
| M4 | PASS | 1.0 | `buscar_peca_catalogo` | 10.93s | oem-miss-ok |
| E1 | PASS | 1.0 | `—` | 4.41s | clarificacao |
| E2 | PASS | 1.0 | `buscar_peca_catalogo` | 19.87s | clarificacao |
| E2b | PASS | 1.0 | `—` | 13.46s | peca+preco |
| E3 | PASS | 1.0 | `—` | 5.16s | gibberish |
| P1 | PASS | 1.0 | `ConsultaPlaca` | 6.04s | placa |
| V1 | PASS | 1.0 | `buscar_por_viscosidade` | 18.15s | oleo+preco |
| S1 | PASS | 1.0 | `buscar_peca_catalogo, consultar_estoque_peca01, consultar_estoque_peca04, consultar_estoque_peca05` | 20.1s | codigo |
| T1 | PASS | 1.0 | `buscar_peca_catalogo` | 12.78s | oem-miss-ok |

## Comparativo vs baseline

| Tema | Antes | Agora |
|---|---|---|
| Código 000781/081952 via search | miss tok | L0 `layer=codigo` + prompt |
| Pastilha + s10 2016 | miss STRICT | hit strict (sem exigir ano) |
| Bateria + strada | miss | hit `unscoped` com preço |
| Filtro óleo | mangueira | ranking favorece filtro óleo |
| Pastilha dianteira Onix/S10 | miss (tok dianteira) | posição só no ranking; hit DT |
| OEM TH9451 falso ERP | 009451 alicate | L0 sem strip de letras |

## Próximo gap se < 10
- Índice `gpasi:fab:` completo + OEM em texto de aplicação
- Enrich blocos skip `0001:15–42`
- Prompt: com veículo completo, buscar na hora (sem ABS/ano extra)
