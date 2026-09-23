# Espelho Redis GPASI

Export do que está no ar em 18/08/2026: API FastAPI `gpasi-search` v1.6 + workflow n8n **teste espelho redis** (AI Agent).

Checksum da API (local = VPS `/opt/gpasi-sync` = container `gpasi-search`):  
`dd0f35d82b6eba4bf8aee2404b7ee30e6b3ccb750f4ce9a0da3eef4bde9c320c`

## Pasta

| Caminho | O quê |
|---|---|
| `api/gpasi_search_api.py` | Microserviço FastAPI (Redis-only quando `fonte=gpasi`) |
| `api/Dockerfile` | Imagem `gpasi-search` |
| `api/requirements.txt` | Dependências |
| `n8n/teste-espelho-redis.json` | Workflow para importar no n8n |
| `n8n/system-prompt.txt` | Prompt do AI Agent |

Fonte canônica no repo: `scripts/gpasi_search_api.py` (esta pasta é snapshot).

## API (`gpasi-search`)

Rede interna n8n: `http://gpasi-search:8080`

| Método | Rota | Uso |
|---|---|---|
| GET | `/health` | Redis + cobertura |
| GET | `/search?q=&modelo=&viscosidade=&fonte=gpasi&limit=5` | Busca do agente |
| GET | `/peca/{codigo}` | Hash direto |

`fonte=gpasi` não cai no fallback Supabase.

Cascata: L0 código ERP → L1 strict → L2 soft_aplic → L3 primary → L4 unscoped.

## Workflow n8n

- Editor: https://n8n.autopecas.tech/workflow/cXFFcaGofHLQhKkn
- Chat: https://n8n.autopecas.tech/webhook/381012e6-13fa-4b43-8faf-11dd647b69a3/chat

Chat Trigger → AI Agent (`gpt-5-mini`) + Redis memory → tools `buscar_peca_catalogo` e `buscar_por_viscosidade`.

Import: n8n → Workflows → Import from File → `n8n/teste-espelho-redis.json`.  
As credenciais OpenAI (`Vinicius`) e Redis (`Redis GPASI tecdoc_redis`) precisam existir na instância.
