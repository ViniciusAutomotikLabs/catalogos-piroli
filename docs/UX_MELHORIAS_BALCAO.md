# Pesquisa UX — Melhorias para o Catálogo Industrial

Documento condensado para guiar implementação. Foco: **vendedor de balcão de autopeças (linha pesada)** — rápido, preciso, operacional.

**Contexto:** app web Next.js + Supabase que consolida 100+ catálogos de fornecedores. Sistema legado de referência: **SS Plus v12** (ERP desktop Windows).

**Documentos relacionados:** `Telas_MVP.md`, `docs/ROADMAP_MVP.md`, `PROJETO_HISTORICO.md` (§ UX balcão + redesign visual)

**Última atualização:** 03/07/2026 — consolida pesquisa original (02/07), implementação P0 parcial, redesign visual e auditoria pós-redesign para handoff frontend.

---

## 0. Status consolidado (para o dev frontend)

### Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Implementado e no working tree (não necessariamente em produção) |
| 🟡 | Parcial — funciona mas incompleto ou precisa refinamento |
| ⬜ | Pendente — ainda não implementado |
| 🔴 | Regressão ou problema visual identificado na auditoria |

### Resumo executivo

| Área | Status | Próximo passo |
|------|--------|---------------|
| Shell responsivo (drawer mobile) | ✅ | Focus trap no drawer/modais |
| Busca — estrutura de linha | 🟡 | Parser de descrição; match destacado |
| Busca — ações na linha | ✅ | Considerar ícones + row click → drawer |
| Detalhe do produto | 🟡 | Drawer lateral; similares; aplicação real |
| WhatsApp editável | ✅ | — |
| Dashboard repaginado | ✅ | Compactar hero; remover redundâncias |
| Redesign visual (paleta, sidebar dark) | ✅ | Simplificar acentos; polir telas secundárias |
| Parser de descrições | ⬜ | Alta prioridade — dados brutos do PDF |
| Match exato + atalhos teclado | ⬜ | Fase D |
| Busca por veículo | ⬜ | Fase F |
| Estoque/preço | ⬜ | MVP 2.0 |

---

## 1. Persona principal

**Vendedor de balcão / vendedor interno de autopeças**

| Aspecto | Descrição |
|---------|-----------|
| Contexto | Balcão, telefone e WhatsApp ao mesmo tempo; cliente esperando |
| Entrada típica | Código antigo, descrição vaga, peça na mão, foto, áudio, referência cruzada |
| Objetivo | Achar a peça certa, confirmar equivalência, ver estoque/preço, montar orçamento e enviar |
| Risco | Peça errada = devolução, perda de confiança, retrabalho |

**Objetivos do vendedor**
1. Encontrar peça por código, referência, descrição ou aplicação
2. Confirmar equivalência entre marcas/catálogos
3. Ver estoque, preço e disponibilidade rapidamente
4. Montar orçamento e enviar por WhatsApp sem redigitar
5. Manter histórico por oficina/cliente

**Dores atuais**
- Descrições técnicas longas e difíceis de comparar *(ainda presente — parser pendente)*
- Falta de foto, aplicação e fabricante reduz confiança
- Alternância entre catálogo, ERP, WhatsApp e memória
- Pressão de tempo com cliente na linha
- Confusão entre peças parecidas (código ou aplicação)

---

## 2. Análise heurística das telas

### 2.1 O que já funciona (atualizado 03/07/2026)

| Item | Status | Notas |
|------|--------|-------|
| Navegação clara (sidebar + hierarquia) | ✅ | Sidebar dark fixa em `lg+`; drawer no mobile via `NavShell` |
| Busca em destaque | ✅ | Hero no dashboard + página `/busca` dedicada |
| Layout limpo e profissional | 🟡 | Redesign SaaS aplicado; inconsistência em telas secundárias |
| Fluxo busca → orçamento → WhatsApp | ✅ | Botão `+ Orçamento` na linha; WhatsApp com prévia editável |
| CRM e configurações para MVP | ✅ | Funcional; visual ainda sem polish |
| Ações sempre visíveis (a11y) | ✅ | Sem hover-only; `aria-label` nos botões de linha |
| Normalização de código na busca | ✅ | `apenasCodigo()` tolera `.`, `-`, espaço |
| Chips de referências cruzadas | ✅ | Até 3 chips + contador; selo "via referência" |
| Códigos copiáveis no detalhe | ✅ | `CodigoChip` em `/produtos/[id]` |
| Histórico com termo pesquisado | ✅ | Chip com termo na lista do dashboard e histórico |

### 2.2 Problemas por tela — estado original vs. atual

| Tela | Problema (pesquisa 02/07) | Status hoje | O que falta |
|------|---------------------------|-------------|-------------|
| **Busca** | Descrição longa concatenada | 🟡 | `line-clamp-1` corta mas não estrutura; parser pendente |
| **Busca** | Coluna `Fabricante` vazia | ✅ | Substituída por Aplicação/Referências |
| **Busca** | Placeholder de foto repetido | ✅ | Ícone discreto quando sem foto |
| **Busca** | Coluna `Ação` vazia | ✅ | Orçamento + WhatsApp + Ver detalhes |
| **Busca** | Chips de catálogo pouco úteis | 🟡 | Filtros existem; falta orientação à tarefa |
| **Início** | Cards de status competem com histórico | 🟡 | Dashboard 2/3+1/3; hero ainda alto demais |
| **Início** | Histórico sem contexto | ✅ | Termo + fabricante + tempo relativo |
| **Orçamento** | Preço sem contexto comercial | ⬜ | Margem/validade por item — MVP 2.0 |
| **Orçamento** | Botões competem | 🟡 | WhatsApp primário no modal; barra inferior a revisar |
| **Veículo** | Não implementado | ⬜ | Gap frente ao legado |
| **CRM** | Lista administrativa | 🟡 | WhatsApp unificado; falta contexto comercial |

**Diagnóstico geral (03/07):** o app saiu de "bonito e simples" para "SaaS moderno com fluxo operacional básico". Ainda falta **densidade informacional** (parser, drawer, match destacado) para rivalizar com o SS Plus no balcão.

---

## 3. Gap analysis vs. SS Plus (sistema legado)

O legado é visualmente ultrapassado, mas entrega **densidade operacional**. O vendedor valoriza informação, não estética.

| Capacidade do SS Plus | Valor para o vendedor | Status no app | Como trazer |
|-----------------------|----------------------|---------------|-------------|
| **Similares e agregados** | Equivalente quando código original indisponível | ⬜ | Seção no detalhe com grau de confiança |
| **Estoque por filial** | Fechar venda na hora | ⬜ | Placeholder "Consultar no ERP" → integração MVP 2.0 |
| **Aplicação por veículo** | Confirmar que serve (Randon, ano, eixo) | 🟡 | Placeholder intencional no detalhe; dados reais pendentes |
| **Códigos técnicos separados** | Interno, fabricante, refs, equivalentes | 🟡 | Chips copiáveis ✅; parser para extrair do texto bruto ⬜ |
| **Preço e estoque na mesma tela** | Sem alternar sistemas | ⬜ | MVP 2.0 |

**Princípio:** clareza visual do app novo + densidade útil do legado. **Não copiar** o visual verde denso do SS Plus — copiar a **estrutura da informação**.

---

## 4. Recomendações priorizadas (com status)

### P0 — Essencial para adoção no balcão

#### 4.1 Reestruturar resultado de busca — 🟡 PARCIAL

Cada linha deve permitir decisão em segundos:

```
┌─────────────────────────────────────────────────────────────────┐
│ [foto]  Pino tensor Randon M24x2                    [EIXOSUL]  │
│         Cód. 525 · Ref. 804062, 478, 5995                      │
│         Aplicação: Randon MOD 2000 / Facchini / Guerra         │
│         [Ver detalhes]  [+ Orçamento]  [Copiar código]         │
└─────────────────────────────────────────────────────────────────┘
```

| Requisito | Status | Arquivo |
|-----------|--------|---------|
| Título curto normalizado | ⬜ | `src/lib/descricao-parser.ts` (criar) |
| Código principal em destaque | ✅ | `busca/page.tsx` |
| Chips de referências cruzadas | ✅ | `busca/page.tsx` |
| Aplicação resumida em uma linha | ⬜ | Depende de dados/parser |
| Badge do catálogo/fornecedor | 🟡 | Filtros por catálogo existem; badge na linha ⬜ |
| Ações rápidas na linha | ✅ | `adicionar-orcamento-button.tsx`, `whatsapp-row-button.tsx` |
| Destaque de match (código/ref) | ⬜ | `busca/page.tsx` |

#### 4.2 Drawer/tela de detalhe do produto — 🟡 PARCIAL

| Requisito | Status | Arquivo |
|-----------|--------|---------|
| Página de detalhe enriquecida | ✅ | `produtos/[id]/page.tsx` |
| Chips copiáveis de códigos | ✅ | `produto/codigo-chip.tsx` |
| Drawer lateral (row click) | ⬜ | Novo: `produto/drawer-produto.tsx` |
| Equivalências e similares | ⬜ | Quando dados existirem |
| Aplicações estruturadas | 🟡 | Placeholder no detalhe |
| Texto original colapsável | ⬜ | `produtos/[id]/page.tsx` |
| Estoque/preço | ⬜ | MVP 2.0 |

#### 4.3 Melhorar legibilidade das descrições — ⬜ PENDENTE (alta prioridade)

- **Na tabela:** versão normalizada e escaneável
- **No detalhe:** descrição bruta em "Texto original do catálogo"
- Parser para extrair: título, códigos (`COD:`, padrões numéricos), aplicação, medidas
- Tratar casos reais: `RANDON COD: 537 COD: 2456...`, `CÓDIGO DESCRIÇÃO CONECTOR...`

**Exemplos de saída do parser:**

| Entrada (bruta) | Título exibido | Chips extraídos |
|-----------------|----------------|-----------------|
| `RANDON COD: 537 COD: 2456 BAL TR CAVALO...` | BAL TR CAVALO RANDON Ø50 | `537`, `2456`, `641` |
| `CÓDIGO DESCRIÇÃO 1386677 CONECTOR FILTRO` | Conector filtro RACOR Ø12 | `1386677` |

**Arquivos:** `src/lib/descricao-parser.ts` (novo), `busca/page.tsx`, `page.tsx` (dashboard), `historico/page.tsx`

#### 4.4 Adaptar colunas vazias — ✅ FEITO

- `Fabricante` vazio → **Referências** com chips
- Placeholder de foto discreto (ícone menor)

#### 4.5 WhatsApp como fluxo principal — ✅ FEITO

Prévia editável no modal de orçamento e produto; `buildWhatsAppUrl` usa texto editado.

**Arquivos:** `src/lib/whatsapp.ts`, `orcamento/barra-acoes.tsx`, `produto/acoes.tsx`

---

### P1 — Alto impacto (após P0)

| Item | Status | Descrição |
|------|--------|-----------|
| Busca por código exato priorizado | 🟡 | Normalização ✅; ranking e badge "match exato" ⬜ |
| Autocomplete e histórico | ⬜ | Sugerir códigos recentes, peças mais buscadas |
| Atalhos de teclado | ⬜ | `/` foca busca · `A` orçamento · `W` WhatsApp |
| Estados vazios | ✅ | Sugestões na busca sem resultado |
| CRM conectado | ⬜ | Últimos orçamentos, peças cotadas, WhatsApp direto |
| Focus trap modais/drawer | ⬜ | A11y — drawer mobile e modais de WhatsApp |

---

### P2 — Diferenciação e escala

| Item | Status |
|------|--------|
| Busca por veículo | ⬜ |
| Indicadores de confiança do match | ⬜ |
| Fotos colaborativas | ⬜ |
| Comparação de similares | ⬜ |

---

## 5. Quick wins — checklist atualizado

| # | Item | Status | Arquivos |
|---|------|--------|----------|
| 1 | Trocar coluna `Fabricante` por `Referências` | ✅ | `busca/page.tsx` |
| 2 | Título curto + chips de códigos + texto secundário | ⬜ | `descricao-parser.ts` |
| 3 | Botão `+ Orçamento` na linha | ✅ | `adicionar-orcamento-button.tsx` |
| 4 | Destacar match (código/referência) | ⬜ | `busca/page.tsx` |
| 5 | Drawer de detalhe (Códigos · Aplicação · Similares · Texto original) | 🟡 | Página existe; drawer ⬜ |
| 6 | Template WhatsApp editável | ✅ | `barra-acoes.tsx`, `acoes.tsx` |
| 7 | Últimas buscas com termo + produto | ✅ | `page.tsx`, `historico/page.tsx` |
| 8 | Reduzir peso do placeholder de foto | ✅ | `busca/page.tsx` |

---

## 6. Auditoria visual pós-redesign (03/07/2026)

Auditoria sistemática após o redesign "SaaS moderno" (`globals.css`, sidebar dark, dashboard repaginado). Objetivo: identificar refinamentos antes de considerar a UI "pronta para balcão".

### 6.1 O que o redesign acertou

| Área | Mudança aplicada |
|------|------------------|
| Paleta | Slate neutro + azul `#2563eb` + esmeralda `#059669` (`globals.css` `@theme`) |
| Sidebar | Dark `#0f172a`, item ativo com borda esmeralda, logo badge |
| Componentes | `rounded-xl`, sombras suaves, hover, `focus-visible:ring` |
| Busca | Filtros em pills, colunas FOTO/PEÇA/AÇÕES, paginação em pílula |
| Dashboard | Grid 2/3 histórico + 1/3 atalhos; hero de busca |
| A11y | Contrastes AA; ações sempre visíveis |

### 6.2 Problemas visuais identificados (handoff frontend)

#### Layout e posição

| # | Problema | Impacto | Recomendação | Prioridade | Arquivos |
|---|----------|---------|--------------|------------|----------|
| V1 | Header repete "Catálogo Industrial" enquanto sidebar já tem branding | Desperdiça ~56px verticais em toda tela | Desktop: busca global compacta ou breadcrumb contextual; mobile: manter hamburger + ícones | **P0** | `shell/header.tsx` |
| V2 | Hero do dashboard alto demais (`py-10`, título centralizado) | Histórico fica abaixo da dobra | Hero compacto (`py-5`, alinhado à esquerda) ou busca só no header em `lg+` | **P0** | `page.tsx` |
| V3 | Rail "Atalhos rápidos" duplica sidebar (Busca, Orçamento, CRM, Catálogos) | 1/3 da tela com baixo valor | Substituir por orçamentos rascunho / cliente recente / alerta sync; ou histórico full-width | **P1** | `page.tsx` |
| V4 | Mobile: chips do hero quebram em 3 linhas; placeholder truncado | Visual desalinhado | `flex-nowrap overflow-x-auto` nos chips; placeholder curto no mobile | **P1** | `page.tsx` |
| V5 | Busca: 3 botões por linha (Orçamento, WhatsApp, Ver) | Apertado em telas médias | Ícones + tooltip; row click → drawer (futuro) | **P2** | `busca/page.tsx` |

#### Cores e identidade

| # | Problema | Recomendação | Prioridade | Arquivos |
|---|----------|--------------|------------|----------|
| V6 | Muitos acentos: azul (primary) + verde (sidebar ativo, carrinho, WhatsApp, suporte) | Regra: **azul** = nav/ações/código; **verde** = só WhatsApp e sucesso | **P1** | `sidebar.tsx`, `header.tsx`, `page.tsx` |
| V7 | Sidebar usa `bg-[#0f172a]` hardcoded fora do `@theme` | Usar token `--color-inverse-surface` ou novo `--color-sidebar` | **P2** | `globals.css`, `sidebar.tsx` |
| V8 | Split dark sidebar / light content abrupto | Sidebar clara (Linear) OU header em tom slate como ponte | **P3** | Decisão de design |

#### Tipografia

| # | Problema | Recomendação | Prioridade |
|---|----------|--------------|------------|
| V9 | Excesso de `text-label-sm uppercase` ("Consulta de peças", "Atalhos", "Buscar", colunas FOTO/PEÇA) | Sentence case em labels; uppercase só em CTAs primários | **P1** | Vários — ver grep `uppercase` |

#### Dados e densidade

| # | Problema | Recomendação | Prioridade |
|---|----------|--------------|------------|
| V10 | Descrições brutas do PDF (`RANDON COD: 537...`) sem estrutura | Parser (§4.3) — mesma prioridade funcional e visual | **P0** | `descricao-parser.ts` |
| V11 | Métricas do dashboard ("Consultas hoje: 0") com sinal fraco | Barra de status fina: `sync · catálogos · consultas` | **P2** | `page.tsx` |

#### Consistência entre telas

| # | Tela | Status visual |
|---|------|---------------|
| V12 | `/veiculo`, `/configuracoes` | Sem `rounded-xl`/sombras — herdam tokens mas parecem antigas |
| V12 | `/catalogos/upload`, `/clientes/[id]`, `/clientes/novo` | Idem |
| V12 | `/busca`, `/`, `/orcamento`, `/historico`, `/clientes` | Polish aplicado ✅ |

### 6.3 Wireframe alvo (direção visual recomendada)

```
┌─────────────┬──────────────────────────────────────────┐
│ Sidebar     │ [🔍 Busca global sempre visível    🛒 👤] │
│ (slate)     ├──────────────────────────────────────────┤
│             │ sync · 102 catálogos · 3 consultas hoje   │
│             │ ┌─ Histórico recente (denso, 2 linhas) ─┐ │
│             │ │ foto │ código + desc limpa │ ⏱ │ + 🛒  │ │
│             │ └────────────────────────────────────────┘ │
└─────────────┴──────────────────────────────────────────┘
```

- Uma cor de destaque (azul) + verde só onde importa
- Busca sempre acessível no header (desktop)
- Listas densas mas legíveis (2 linhas estruturadas)
- Menos decoração (dot-grid, hero grande) — mais informação útil

---

## 7. Brief consolidado para dev frontend

Ordem de implementação sugerida. Cada item tem critério de aceite testável.

### Sprint visual 1 — Hierarquia e redundância (P0 visual)

| ID | Tarefa | Critério de aceite | Arquivos |
|----|--------|-------------------|----------|
| FE-01 | Header contextual com busca global (`lg+`) | Em desktop, campo de busca no header leva a `/busca?q=`; título "Catálogo Industrial" removido ou vira breadcrumb | `header.tsx`, novo `header-busca.tsx`? |
| FE-02 | Hero dashboard compacto | `py-5` max; título alinhado à esquerda; histórico visível sem scroll em 1080p | `page.tsx` |
| FE-03 | Sentence case nos labels | Remover `uppercase` de labels de seção e colunas; manter em botões primários | grep `uppercase` nos componentes listados em §6.2 V9 |

### Sprint visual 2 — Coesão de cor (P1 visual)

| ID | Tarefa | Critério de aceite | Arquivos |
|----|--------|-------------------|----------|
| FE-04 | Item ativo sidebar em azul | Borda/fundo `primary` no item ativo; verde reservado para WhatsApp/sucesso | `sidebar.tsx` |
| FE-05 | Token sidebar no theme | `bg-[#0f172a]` → token CSS | `globals.css`, `sidebar.tsx` |
| FE-06 | Rail atalhos → conteúdo útil | Remover tiles que duplicam sidebar OU substituir por bloco operacional | `page.tsx` |

### Sprint funcional-visual 3 — Dados legíveis (P0 funcional)

| ID | Tarefa | Critério de aceite | Arquivos |
|----|--------|-------------------|----------|
| FE-07 | Parser de descrição | Função pura com testes; título + chips extraídos dos exemplos §4.3 | `descricao-parser.ts`, `descricao-parser.test.ts` |
| FE-08 | Aplicar parser na busca e listas | Linha mostra título limpo + chips; tooltip com texto bruto | `busca/page.tsx`, `page.tsx`, `historico/page.tsx` |
| FE-09 | Badge de match | Selo "Código exato" / "Via referência" / "Texto" na linha | `busca/page.tsx` |

### Sprint polish 4 — Consistência (P2)

| ID | Tarefa | Arquivos |
|----|--------|----------|
| FE-10 | Polish telas secundárias (`rounded-xl`, cards, sombras) | `veiculo`, `configuracoes`, `catalogos/upload`, `clientes/[id]`, `clientes/novo` |
| FE-11 | Métricas → barra de status | `page.tsx` |
| FE-12 | Focus trap drawer + modais | `nav-shell.tsx`, `barra-acoes.tsx`, `acoes.tsx` |

### Sprint avançado 5 — Densidade SS Plus (P1/P2 funcional)

| ID | Tarefa | Arquivos |
|----|--------|----------|
| FE-13 | Drawer de produto (row click na busca) | Novo componente + integração em `busca/page.tsx` |
| FE-14 | Atalhos de teclado `/`, `A`, `W` | Hook `use-atalhos-busca.ts` |
| FE-15 | Texto original colapsável no detalhe | `produtos/[id]/page.tsx` |

---

## 8. Jornadas ideais

*(Inalterado — referência para validar se cada sprint aproxima o fluxo.)*

### Jornada 1 — Cliente liga pedindo peça por código

```
Cliente liga com código
  → Vendedor pressiona / e digita código          [FE-14 ⬜]
  → Match exato no topo ("encontrado por código")  [FE-09 ⬜]
  → Abre detalhe/drawer, confirma aplicação       [FE-13 ⬜]
  → Adiciona ao orçamento                         [✅]
  → Revisa mensagem WhatsApp e envia              [✅]
```

### Jornada 2 — Cliente manda descrição vaga

```
Cliente: "preciso de um pino tensor Randon M24"
  → Busca por descrição
  → Resultados com título legível (não bruto PDF)  [FE-07/08 ⬜]
  → Filtra por catálogo
  → Abre detalhe, compara similares                [⬜]
  → Envia orçamento                                [✅]
```

### Jornada 3 — Peça sem estoque / código alternativo

```
Código original não disponível
  → Busca código original
  → Vê item + equivalências                        [⬜ MVP 2.0]
  → Escolhe similar compatível
  → Envia orçamento explicando substituição        [✅]
```

### Jornada 4 — Cliente recorrente

```
Oficina que já comprou antes
  → Abre CRM
  → Vê últimas peças cotadas                       [⬜]
  → Reabre orçamento ou adiciona peça
  → Envia WhatsApp                                 [✅]
```

---

## 9. Checklist de implementação (fases A–F atualizado)

### Fase A — Quick wins (busca)

- [x] Nova estrutura de linha na tabela de busca (código + refs + ações)
- [x] Coluna `Referências` no lugar de `Fabricante`
- [x] Botão `+ Orçamento` na linha
- [ ] Parser de descrição (título + códigos + aplicação) — **FE-07**
- [ ] Destaque de match por código/referência — **FE-09**

### Fase B — Detalhe do produto

- [x] Página de detalhe com chips copiáveis
- [ ] Drawer lateral ao clicar na linha — **FE-13**
- [ ] Seção de aplicação estruturada (dados reais)
- [ ] Seção de equivalências/similares
- [ ] Texto original colapsável — **FE-15**

### Fase C — Orçamento e WhatsApp

- [x] Template de mensagem editável
- [x] Prévia antes do envio
- [ ] Vínculo cliente → orçamento mais fluido
- [ ] Observação por item no orçamento

### Fase D — Busca avançada

- [x] Normalização de código (hífen, espaço, ponto)
- [ ] Match exato priorizado no ranking
- [ ] Autocomplete / sugestões
- [ ] Atalhos de teclado — **FE-14**
- [x] Estados vazios melhorados

### Fase E — CRM e histórico

- [x] Histórico de buscas com termo + produto
- [ ] Contexto comercial na ficha da oficina
- [ ] Últimas peças por cliente

### Fase F — Shell e visual (nova — pós-redesign)

- [x] Sidebar responsiva (drawer mobile)
- [x] Redesign paleta + sidebar dark
- [x] Dashboard repaginado
- [ ] Header com busca global — **FE-01**
- [ ] Hero compacto — **FE-02**
- [ ] Simplificar acentos de cor — **FE-04**
- [ ] Sentence case nos labels — **FE-03**
- [ ] Polish telas secundárias — **FE-10**
- [ ] Focus trap modais/drawer — **FE-12**

### Fase G — Integrações (MVP 2.0+)

- [ ] Estoque e preço no resultado
- [ ] Busca por veículo
- [ ] Indicadores de confiança do match
- [ ] Comparação de similares

---

## 10. Métricas de sucesso (pós-implementação)

| Métrica | O que medir |
|---------|-------------|
| Tempo até orçamento enviado | Da busca ao WhatsApp enviado |
| Taxa de match na primeira busca | % de buscas que resultam em peça adicionada sem refinamento |
| Uso do detalhe do produto | Cliques em "Ver detalhes" vs. ação direta na linha |
| Erros de peça errada | Feedback do vendedor / devoluções |
| Adoção vs. SS Plus | Vendedor prefere o app novo para consulta diária? |
| Scroll até histórico no dashboard | Antes/depois de FE-02 (hero compacto) |

---

## 11. Direção geral

> O vendedor não precisa de interface "bonita" no sentido genérico. Precisa de uma tela que responda rapidamente:
>
> **É a peça certa? Serve na aplicação? Tem equivalente? Tem estoque/preço? Consigo mandar para o cliente agora?**

A prioridade não é adicionar muitas telas — é **melhorar a qualidade da informação na busca** e criar um **detalhe de produto forte**, porque é ali que a confiança da venda acontece.

**Estado em 03/07/2026:** base visual moderna entregue; próximo salto = **parser de descrições** (funcional) + **header com busca** e **hero compacto** (visual) + **drawer de produto** (fluxo balcão).

---

## 12. Referência de arquivos (mapa para o dev)

| Área | Arquivos principais |
|------|---------------------|
| Design tokens | `src/app/globals.css` |
| Shell | `src/components/shell/nav-shell.tsx`, `sidebar.tsx`, `header.tsx`, `footer.tsx`, `(app)/layout.tsx` |
| Dashboard | `src/app/(app)/page.tsx`, `components/dashboard/atalho-orcamento.tsx` |
| Busca | `src/app/(app)/busca/page.tsx`, `components/busca/adicionar-orcamento-button.tsx`, `whatsapp-row-button.tsx` |
| Produto | `src/app/(app)/produtos/[id]/page.tsx`, `components/produto/codigo-chip.tsx`, `acoes.tsx` |
| Orçamento | `src/app/(app)/orcamento/page.tsx`, `components/orcamento/barra-acoes.tsx` |
| WhatsApp | `src/lib/whatsapp.ts`, `whatsapp.test.ts` |
| Parser (criar) | `src/lib/descricao-parser.ts` |
| Histórico | `src/app/(app)/historico/page.tsx` |
| CRM | `src/app/(app)/clientes/page.tsx`, `components/clientes/form-cliente.tsx` |
| Telas sem polish | `veiculo/page.tsx`, `configuracoes/page.tsx`, `catalogos/upload/page.tsx`, `clientes/[id]/page.tsx`, `clientes/novo/page.tsx` |

---

*Pesquisa original: 02/07/2026. Implementação P0 parcial + redesign: 02–03/07/2026. Auditoria visual consolidada: 03/07/2026.*
