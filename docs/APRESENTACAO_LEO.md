# Apresentação — Projeto Catálogo / Marketplace Autopeças

> **Público:** Léo Ribeiro + equipe comercial/operacional  
> **Tom:** visual, confiante, sem jargão técnico  
> **Protótipo:** [Stitch — Catálogo Revenda Autopeças](https://stitch.withgoogle.com/projects/15740976723363818684)  
> **Regra deste deck:** usar **somente as 9 telas** listadas na § Telas selecionadas.  
> **Screenshots locais:** `docs/apresentacao/` (PNG já exportados do Stitch)

---

## Instruções para gerar slides

Anexe **este .md** + **PNG de `docs/apresentacao/`** (9 arquivos) e cole:

```text
Transforme APRESENTACAO_LEO.md em deck 16:9, 10–12 slides.
Use SOMENTE as 9 telas da seção "Telas selecionadas" — uma ideia por slide onde couber.
Tom: revenda autopeças BR, linha leve/média. Azul #1b365d + verde WhatsApp #25d366.
Pouco texto (máx. 5 bullets). Notas do apresentador curtas.
Separe visualmente: fluxo vendedor (1.0) vs gestão loja (2.0+).
Slide final: próximos passos + pedido à equipe Léo.
Sem código, SQL ou infra avançada.
```

---

# Telas selecionadas (única fonte visual)

Exporte cada tela no Stitch ou use os **PNG em `docs/apresentacao/`**:

| # | Tela | Fase | Slide(s) | Link Stitch |
|---|------|------|----------|-------------|
| 1 | **Dashboard do Vendedor (W02) v2** | 1.0 | 3, 6 | [abrir](https://stitch.withgoogle.com/projects/15740976723363818684/screens/7adb1e2e868344c1b7acc720f0d2b5fe) |
| 2 | **Resultados de Busca (W03) v3** | 1.0 | 6 | [abrir](https://stitch.withgoogle.com/projects/15740976723363818684/screens/4fbc2d9b70e143d693678e9768dd5f54) |
| 3 | **Detalhe do Produto (W04) v2** | 1.0 | 6, 7 | [abrir](https://stitch.withgoogle.com/projects/15740976723363818684/screens/fd14c3237a0d45a982f5e8aaa59b1404) |
| 4 | **Histórico de Consultas (W08) v2** | 1.0 | 6 | [abrir](https://stitch.withgoogle.com/projects/15740976723363818684/screens/3ab13d256ede4cc6b10b961567857165) |
| 5 | **Administração de Catálogos (W06) v2** | 1.0 / ops | 4, 8 | [abrir](https://stitch.withgoogle.com/projects/15740976723363818684/screens/d9be93be9080431b897de9d498fe4f33) |
| 6 | **Upload de Base de Dados (W09) v2** | 2.0 | 9 | [abrir](https://stitch.withgoogle.com/projects/15740976723363818684/screens/dac52bf1fc904ab2ba4cb1db8fa97d40) |
| 7 | **Gestão de Clientes (W11) v2** | 2.0+ | 9 | [abrir](https://stitch.withgoogle.com/projects/15740976723363818684/screens/caf35efff6794f9f9993041ce017c820) |
| 8 | **Cadastro de Novo Cliente (W14) v2** | 2.0+ | 9 | [abrir](https://stitch.withgoogle.com/projects/15740976723363818684/screens/c131f435e7a94786a26e7a94fdaed60f) |
| 9 | **Carrinho de Orçamento (W12) v2** | 2.0+ | 9, 10 | [abrir](https://stitch.withgoogle.com/projects/15740976723363818684/screens/db690915289441dea8accb8f03412877) |

**IDs para export / MCP:**

```text
7adb1e2e868344c1b7acc720f0d2b5fe  → Dashboard W02 v2
4fbc2d9b70e143d693678e9768dd5f54  → Resultados W03 v3
fd14c3237a0d45a982f5e8aaa59b1404  → Detalhe W04 v2
3ab13d256ede4cc6b10b961567857165  → Histórico W08 v2
d9be93be9080431b897de9d498fe4f33  → Catálogos W06 v2
dac52bf1fc904ab2ba4cb1db8fa97d40  → Upload W09 v2
caf35efff6794f9f9993041ce017c820  → Clientes W11 v2
c131f435e7a94786a26e7a94fdaed60f  → Cadastro W14 v2
db690915289441dea8accb8f03412877  → Orçamento W12 v2
```

**Nomes sugeridos ao exportar PNG:**

```text
01-dashboard-w02.png
02-resultados-w03.png
03-detalhe-w04.png
04-historico-w08.png
05-catalogos-w06.png
06-upload-w09.png
07-clientes-w11.png
08-cadastro-w14.png
09-orcamento-w12.png
```

---

# ROTEIRO DE SLIDES

---

## SLIDE 1 — Capa

**Título:** Catálogo inteligente para revendas de autopeças  
**Subtítulo:** Do balcão ao marketplace — em fases, WhatsApp no centro  
**Visual:** recorte do **Dashboard W02 v2** (tela 1) como hero

**Nota:** Mostrar protótipo real — não prometer marketplace completo amanhã.

---

## SLIDE 2 — O problema hoje

**Título:** O vendedor perde tempo — e vendas — procurando peça

**Bullets:**
- Dezenas de catálogos PDF/planilha de fabricantes
- “Tem filtro pro Gol 2014?” → 5 PDFs, WhatsApp, memória
- Foto ruim na hora de mandar pro cliente
- Referência cruzada espalhada

**Visual:** diagrama simples (sem tela Stitch) — caos PDF → demora → cliente desiste

---

## SLIDE 3 — A solução

**Título:** Um só lugar para consultar — e vender

**Bullets:**
- Catálogo consolidado na nuvem
- Busca por código, descrição ou veículo
- Foto legível + referência cruzada
- WhatsApp como canal principal

**Visual:** **Dashboard do Vendedor (W02) v2** — tela 1

---

## SLIDE 4 — Já temos base (não começamos do zero)

**Título:** Dados reais na nuvem

**Bullets:**
- Pipeline lê PDFs/planilhas e sobe automaticamente
- Produtos, fabricantes, referências cruzadas, fotos
- Catálogos piloto: Disauto, Iguaçu, Kit&Cia
- Meta: **100 catálogos** com foto boa para WhatsApp

**Visual:** **Administração de Catálogos (W06) v2** — tela 5  
**Números:** ~50 mil produtos piloto · fotos até 640 px

---

## SLIDE 5 — Para quem é

**Título:** Revenda linha leve e média

| Quem | O que faz no sistema |
|------|----------------------|
| Vendedor balcão | Busca, detalhe, WhatsApp |
| Dono/gestor | Catálogos, upload estoque, clientes |
| Cliente final | Orçamento via WhatsApp (fases 2+) |

**Visual:** colagem leve — **Detalhe W04** + **Gestão Clientes W11** (telas 3 e 7)

---

## SLIDE 6 — MVP 1.0: fluxo do vendedor (protótipo)

**Título:** Fase 1 — Consulta rápida no balcão

**Fluxo nas telas:**

```text
Dashboard (W02) → Resultados (W03) → Detalhe (W04) → Histórico (W08)
     ①                  ②                 ③               ④
```

**Bullets:**
- Buscar peça em segundos
- Ver foto, fabricante, origem do catálogo
- Referências cruzadas
- Reconsultar histórico do dia

**Visual:** **4 prints em fila** — telas 1, 2, 3, 4 (ordem do fluxo)

**NÃO entra no 1.0:** pagamento online (explícito na fala)

---

## SLIDE 7 — Detalhe do produto (destaque)

**Título:** Tudo que o vendedor precisa numa tela

**Bullets:**
- Código em destaque (monospace)
- Foto grande + referências cruzadas
- Botão **WhatsApp** (diferencial)
- Reportar erro no catálogo central

**Visual:** **Detalhe do Produto (W04) v2** — tela 3 — fullscreen

---

## SLIDE 8 — Roadmap em fases

**Título:** Caminho até o marketplace — sem pular etapas

```text
1.0  Consulta catálogo + WhatsApp     ← telas 1–5 (protótipo pronto)
2.0  Preço + estoque + upload CSV      ← tela 6
2.5  Vitrine + WhatsApp com preço
3.0  Checkout + pagamento              ← telas 7–9 (visão)
4.0  Escala (500+ catálogos, app)
```

**Analogia:** Google das peças → planilha na nuvem → Mercado Livre de autopeças

**Visual:** timeline; thumbnail **Upload W09** (tela 6) no marco 2.0

---

## SLIDE 9 — MVP 2.0+: gestão da loja (protótipo)

**Título:** Fase 2 — Preço, estoque, clientes, orçamento

**Bullets:**
- **Upload CSV** do ERP (qualquer sistema que exporte)
- Gestão de clientes + cadastro
- Carrinho de **orçamento** (ainda sem pagamento online)
- WhatsApp continua canal principal até fase 3

**Visual:** grid 2×2 com telas **6, 7, 8, 9**:
- Upload W09 v2
- Gestão Clientes W11 v2
- Cadastro W14 v2
- Carrinho Orçamento W12 v2

**Nota apresentador:** “Estas telas mostram **para onde vamos** — não entram todas no primeiro release.”

---

## SLIDE 10 — Visão Léo (horizonte)

**Título:** O destino: marketplace de autopeças

**Bullets:**
- Lojista cadastra estoque e preço
- Cliente vê preço e pede no WhatsApp → depois compra no site
- Mesma peça, preços diferentes por loja
- Pagamento integrado na fase 3.0

**Visual:** **Carrinho de Orçamento (W12) v2** — tela 9 — hero

---

## SLIDE 11 — Decisões já alinhadas

| Tema | Decisão |
|------|---------|
| Preço | Interno (custo/margem) + público (preço final) |
| Estoque | Manual + CSV; API ERP depois |
| WhatsApp | Canal principal até checkout (3.0) |
| Contas | 1 revenda = 1 loja; dono cadastra vendedores |
| Catálogo | Lojista sugere correção; equipe aprova |

**Visual:** checklist (sem tela Stitch)

---

## SLIDE 12 — Próximos passos + pedido à equipe

**Próximos 60–90 dias:**
1. Finalizar **100 catálogos** na nuvem
2. Validar protótipo com 1–2 vendedores (“achou em 3 toques?”)
3. Desenvolver app web MVP 1.0 (telas 1–5)
4. Piloto em 1–3 revendas

**Precisamos do Léo:**
- [ ] 1–3 lojas piloto
- [ ] Feedback nas 9 telas do Stitch
- [ ] Códigos reais que clientes pedem todo dia

**Visual:** **Dashboard W02 v2** (tela 1) + call-to-action

---

## SLIDE 13 (opcional) — Fechamento

> **MVP 1.0 vende o catálogo. MVP 2.0 vende preço e estoque. MVP 3.0 vende a transação.**

**Subtexto:** WhatsApp no centro em todas as fases.

---

# Mapeamento rápido: tela → fase do produto

| Tela Stitch | MVP |
|-------------|-----|
| Dashboard W02 v2 | **1.0** — home/busca |
| Resultados W03 v3 | **1.0** — lista |
| Detalhe W04 v2 | **1.0** — core + WhatsApp |
| Histórico W08 v2 | **1.0** — produtividade |
| Admin Catálogos W06 v2 | **1.0** — ops / gestor |
| Upload W09 v2 | **2.0** — estoque CSV |
| Gestão Clientes W11 v2 | **2.0+** |
| Cadastro W14 v2 | **2.0+** |
| Carrinho Orçamento W12 v2 | **2.0+** — antes do checkout 3.0 |

---

# Q&A rápido

**“Quando compra no site?”** → Fase 3.0. Até lá, WhatsApp + orçamento.

**“Igual Mercado Livre?”** → Visão sim. MVP 1.0 é ferramenta de balcão.

**“Quem sobe os PDFs?”** → Equipe técnica (tela Catálogos W06).

**“ERP diferente por loja?”** → Upload CSV (tela W09) funciona com qualquer export.

---

*Atualizado 24/05/2026 · 9 telas Stitch selecionadas · Projeto `15740976723363818684`*
