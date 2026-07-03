# Telas MVP — Catálogo na Revenda de Autopeças

Documento para **Google Stitch** (protótipos web + mobile).  
**Projeto Stitch:** [stitch.withgoogle.com/projects/15740976723363818684](https://stitch.withgoogle.com/projects/15740976723363818684) · ID `15740976723363818684`  
Baseado no que já existe: ingestão `main2.py` → Supabase (`produtos`, `fabricantes`, `referencias_cruzadas`, `catalogos`, fotos no Storage).

---

## 1. Visão do produto

### O que é

Software para **revendas de autopeças** (balcão, estoque e vendedores de piso) consultarem um **catálogo consolidado** de dezenas de fabricantes — o mesmo dado que hoje sobe via PDF/planilha e já está no Supabase.

### Público-alvo

| Quem | Perfil |
|------|--------|
| **Loja** | Revenda que vende peças para **linha leve e média**: carros de passeio, utilitários, **picapes, vans, SUVs** — **não** foco em caminhão pesado / ônibus |
| **Usuários na loja** | Dono/gestor, vendedor de balcão, vendedor de piso (celular), às vezes comprador/estoquista |
| **Momento de uso** | Cliente na frente do balcão ou no WhatsApp: “tem filtro X pro Gol 2014?” / “qual o código equivalente?” |

### Proposta de valor (MVP de telas)

1. **Buscar rápido** por código, descrição ou veículo (quando houver aplicação).
2. **Ver foto legível** (qualidade WhatsApp — até 640 px).
3. **Referência cruzada** (OEM / concorrente) num toque.
4. **Enviar para o cliente** (WhatsApp) com imagem + dados — **diferencial do produto até o MVP 3.0** (ver § 14).
5. **Saber de qual catálogo veio** o item (transparência para o vendedor).

### Fora do MVP de telas (fase 2+)

- Preço e estoque da loja → **MVP 2.0** (`docs/ROADMAP_MVP.md`)
- Vitrine pública com preço → **MVP 2.5**
- PDV / emissão de NF
- Pedido online com pagamento → **MVP 3.0**
- CRM completo

### Documentos relacionados

| Arquivo | Uso |
|---------|-----|
| `docs/ROADMAP_MVP.md` | Fases 1.0 → 3.0, preço, estoque, ERP |
| `docs/MVP_VALIDACAO.md` | Pipeline 100 catálogos |
| `ARQUITETURA_ESCALA.md` | Escala de dados |

---

## 2. Personas e jornadas

### Persona A — Carlos, vendedor de balcão (web)

- PC ou tablet na bancada, tela grande.
- Digita código que o mecânico ditou ou cola do WhatsApp.
- Precisa de lista densa, atalhos de teclado, copiar código.

### Persona B — Ana, vendedora de piso (mobile)

- Celular Android, uma mão, cliente ao lado.
- Busca por voz ou por **montadora/modelo/ano**.
- Compartilha foto + texto no WhatsApp do cliente.

### Persona C — Roberto, dono da loja (web — config)

- Vê se o catálogo “subiu” (status dos fabricantes).
- Define nome da loja, logo, usuários (futuro).

---

## 3. Dados já disponíveis (mapear nas telas)

Campos reais do pipeline atual:

| Campo UI | Origem no banco |
|----------|-----------------|
| Código do produto | `produtos.codigo_produto_interno` |
| Número / referência | `produtos.numero_produto` |
| Descrição | `produtos.descricao` |
| Unidade | `produtos.unidade` (ex.: PC, JG) |
| Foto | `produtos.foto_url` (Storage público) |
| Observações | `produtos.observacoes` |
| Fabricante | `fabricantes.nome_fabricante` |
| Catálogo de origem | `produtos.origem_catalogo` / `catalogos.nome_exibicao` |
| Referências cruzadas | `referencias_cruzadas.numero_referencia`, `fabricante_referencia` |
| Status ingestão | `catalogos.status`, `produtos_count`, `imagens_count` |

**Exemplos para protótipo (Stitch):**

- Código: `201.0813` · Descrição: `Filtro de óleo` · Fabricante: `Fram`
- Origem catálogo: `iguacu` · Foto: placeholder retangular 4:3
- Ref. cruzada: `PH2870A` (Mahle), `OC90` (Mann)

---

## 4. Design system (sugestão para Stitch)

### Tom visual

- **Profissional e limpo** — ambiente de loja, não e-commerce fashion.
- Confiança: azul petróleo ou azul industrial + cinza neutro.
- Alto contraste para leitura sob luz fluorescente.

### Tokens

| Token | Web | Mobile |
|-------|-----|--------|
| Fonte títulos | 20–24 px semibold | 18–20 px |
| Fonte corpo / lista | 14–16 px | 15–16 px |
| Código produto | Monospace ou tabular, destaque | Mesmo |
| Touch target | — | mín. 44 px |
| Grid web | 12 col, sidebar 240 px | — |
| Bottom nav mobile | — | 4 itens |

### Componentes recorrentes

- Barra de busca fixa (sticky)
- Chip de filtro: Montadora · Modelo · Ano · Catálogo · Fabricante
- Card de produto (thumb + código + descrição + origem)
- Bottom sheet (mobile): detalhe e “Enviar WhatsApp”
- Empty state: “Nenhuma peça encontrada — tente o código ou outra referência”
- Badge de catálogo: `Iguaçu`, `Kit&Cia`, `Disauto`

### Ícones sugeridos

Busca · Carro (aplicação) · WhatsApp · Copiar · Histórico · Catálogo · Configurações · Filtro

---

## 5. Mapa de navegação

```text
[Login] → [Home]
            ├── Busca → Lista → Detalhe produto → Compartilhar WhatsApp
            ├── Busca por veículo → Lista → Detalhe
            ├── Catálogos (lista fabricantes/fontes) → Produtos do catálogo
            ├── Histórico / Recentes
            └── Configurações (loja, sobre, status catálogos)

Web: sidebar permanente · Mobile: bottom navigation
```

---

## 6. Telas — versão WEB (balcão / gestor)

Use cada bloco **“Prompt Stitch”** copiando no Google Stitch. Ajuste idioma se o Stitch estiver em inglês.

---

### W01 — Login da loja

**Objetivo:** Identificar a revenda e o vendedor (multi-loja no futuro).

**Layout**

- Centro: card 400 px
- Logo placeholder “AutoPeças [Nome da Loja]”
- Campos: E-mail ou usuário · Senha
- Botão primário: Entrar
- Link: Esqueci minha senha
- Rodapé: “Catálogo consolidado · 100+ fontes”

**Prompt Stitch**

> Desktop web app login screen for Brazilian auto parts store staff. Clean industrial UI, dark blue primary, white card centered, logo placeholder, email and password fields, primary button "Entrar", subtle footer text about consolidated catalogs. Professional, not playful. 1440px width mockup.

---

### W02 — Home / Dashboard do vendedor

**Objetivo:** Atalho para busca e visão do dia.

**Layout**

- **Sidebar esquerda (240 px):** Logo loja · Busca · Veículo · Catálogos · Histórico · Config
- **Área principal:**
  - Busca grande com placeholder: `Código, descrição ou referência (ex: 201.0813, PH2870A)`
  - Atalhos: “Buscar por veículo” · “Últimas consultas”
  - Cards resumo: `Catálogos ativos: 87` · `Última atualização: hoje`
  - Lista “Consultados recentemente” (5 itens com thumb)

**Prompt Stitch**

> Auto parts counter dashboard web app, left sidebar navigation, large search bar, quick action chips for vehicle search and recent lookups, small stat cards, recent products list with thumbnails. Brazilian Portuguese labels. Professional B2B style, 1440px desktop.

---

### W03 — Resultados de busca (lista)

**Objetivo:** Comparar vários itens rapidamente.

**Layout**

- Barra de busca sticky no topo (termo: `filtro gol`)
- Filtros em chips: Todos · Com foto · Iguaçu · Kit&Cia · Disauto
- Ordenar: Relevância · Código A–Z
- **Tabela / lista densa:**
  - Colunas: Foto 48px · Código · Descrição · Fabricante · Catálogo · Ação
  - Linha exemplo destacada ao hover
- Paginação: `1–25 de 342`
- Estado vazio (variante): ilustração simples + texto de ajuda

**Prompt Stitch**

> Search results page for auto parts catalog, dense data table with product thumbnail, code, description, brand, catalog source badge, 25 rows, filter chips on top, sticky search, pagination footer. Desktop web, Portuguese Brazil, industrial blue theme.

---

### W04 — Detalhe do produto

**Objetivo:** Tudo que o vendedor precisa para vender e cruzar referência.

**Layout**

- Breadcrumb: Busca › Filtro de óleo
- **Coluna esquerda (40%):** Foto grande 4:3, botões: Ampliar · Baixar
- **Coluna direita:**
  - Código grande: `201.0813`
  - Descrição H1
  - Fabricante · Unidade: `PC`
  - Badge catálogo: `Iguaçu`
  - Bloco **Referências cruzadas** (tabela): Número · Marca · Tipo
  - Bloco **Aplicações** (MVP: placeholder “Em breve” ou 2–3 linhas exemplo: VW Gol 1.0 2008–2012)
  - Observações (texto menor, cinza)
- **Barra de ações fixa inferior:** Copiar código · Copiar texto · Enviar WhatsApp · **Reportar erro** · Voltar
- **Reportar erro:** abre modal curto (descrição/foto/ref. errada) → fila de sugestão; catálogo central não é editado direto (§ 9.1 roadmap)

**Prompt Stitch**

> Product detail page auto parts B2B web app, large product image left, product code and description right, cross-reference table, vehicle fitment section, catalog source badge, action bar with Copy and WhatsApp share. Desktop layout, Portuguese labels.

---

### W05 — Busca por veículo

**Objetivo:** Atender “peça do Gol 2014” sem saber o código.

**Layout**

- Step visual: 1 Montadora › 2 Modelo › 3 Ano › 4 Resultados
- Dropdowns ou autocomplete em cascata
- Montadoras exemplo: VW, Fiat, Chevrolet, Ford, Toyota, Hyundai
- Modelos: Gol, Palio, Onix, HB20…
- Ano: slider ou select 1990–2026
- Botão: Buscar peças
- Área de resultados igual W03 (reuso)

**Prompt Stitch**

> Vehicle fitment search wizard for auto parts store, cascading dropdowns manufacturer model year, search button, then product results list below. Desktop web, clean forms, Portuguese Brazil, light and medium vehicles only (cars, pickups, vans).

---

### W06 — Catálogos / Fontes disponíveis

**Objetivo:** Transparência — de onde vem cada base (alinhado a `catalogos` no Supabase).

**Layout**

- Título: Catálogos na nuvem
- Grid de cards: logo/nome · Status (OK / Processando / Erro) · Qtd produtos · Qtd fotos
- Exemplos: Disauto · Iguaçu · Kit&Cia · Bosch 2026 (pendente)
- Clique no card → W07

**Prompt Stitch**

> Catalog sources admin grid for auto parts reseller, each card shows catalog name, status badge green yellow red, product count and image count, cloud sync metaphor. Desktop dashboard Portuguese.

---

### W07 — Produtos de um catálogo

**Objetivo:** Navegar só dentro de um fabricante/fonte.

**Layout**

- Header: `Catálogo Iguaçu` + busca local
- Filtro lateral: Fabricante (checkbox)
- Lista igual W03, sem coluna “Catálogo”

**Prompt Stitch**

> Filtered product list inside single catalog source, sidebar brand filters, search within catalog, product table with photos. B2B auto parts web.

---

### W08 — Histórico de consultas

**Objetivo:** Repetir busca do cliente que voltou.

**Layout**

- Lista por data: Hoje · Ontem
- Item: hora · termo buscado · produto aberto · botão reabrir

**Prompt Stitch**

> Search history timeline for auto parts counter staff, grouped by today and yesterday, reopen product link. Simple list desktop web Portuguese.

---

### W09 — Configurações da loja

**Objetivo:** Identidade e status (gestor).

**Layout**

- Abas: Loja · **Usuários** · Catálogos · Sobre
- Loja: Nome fantasia · CNPJ · Telefone WhatsApp da loja · Logo upload
- **Usuários:** dono convida vendedores por e-mail (papel `dono` / `vendedor`); ver `docs/ROADMAP_MVP.md` § 9.2
- Catálogos: link para W06
- Sobre: versão app · suporte

**Prompt Stitch**

> Settings page small business auto parts store, tabs for store profile and catalog status, form fields company name CNPJ phone, logo upload area. Desktop admin UI Portuguese.

---

### W10 — Compartilhar / WhatsApp (modal web)

**Objetivo:** Montar mensagem antes de abrir WhatsApp Web.

**Layout**

- Modal 520 px
- Preview mensagem:
  ```text
  🔧 Filtro de óleo
  Código: 201.0813
  Fabricante: Fram
  Ref.: PH2870A (Mahle)
  [Loja AutoPeças Centro]
  ```
- Toggle: incluir foto
- Botões: Copiar texto · Abrir WhatsApp Web

**Prompt Stitch**

> Modal dialog preview WhatsApp message for auto parts product with optional image toggle, copy text and open WhatsApp web buttons. Desktop overlay Portuguese Brazil.

---

## 7. Telas — versão MOBILE (vendedor de piso)

Breakpoints: **390 × 844** (iPhone/Android comum).  
Navegação inferior: **Buscar · Veículo · Recentes · Mais**

---

### M01 — Splash / Login mobile

**Layout**

- Logo + nome da loja
- E-mail · Senha · Entrar
- Teclado-friendly, botão grande

**Prompt Stitch**

> Mobile login screen auto parts seller app, large touch targets, blue industrial theme, Portuguese Entrar button, iPhone 14 frame 390px width.

---

### M02 — Busca (home mobile)

**Layout**

- Header: nome loja compacto
- Search bar com ícone microfone (opcional)
- Sugestões: Últimas buscas (chips)
- Teclado numérico amigável para códigos
- Banner discreto: `87 catálogos · atualizado hoje`

**Prompt Stitch**

> Mobile home search first auto parts app, prominent search field, recent search chips, catalog status banner, bottom navigation four tabs. Portuguese Brazil seller UX.

---

### M03 — Lista de resultados mobile

**Layout**

- Sticky search + filtro ícone
- Cards verticais: thumb esquerda · código bold · 2 linhas descrição · badge catálogo
- Scroll infinito
- FAB opcional: filtrar

**Prompt Stitch**

> Mobile search results list cards with product thumbnail code description catalog badge, infinite scroll, sticky search bar, auto parts catalog app Portuguese.

---

### M04 — Detalhe produto (mobile)

**Layout**

- Hero image swipeable
- Código + descrição + fabricante
- Seções colapsáveis: Referências cruzadas · Aplicações · Observações
- **Sticky bottom bar:** WhatsApp (primário) · Copiar · Favorito

**Prompt Stitch**

> Mobile product detail auto parts, swipeable photo, collapsible sections cross references vehicle fitment, sticky bottom action bar WhatsApp primary green accent. Portuguese labels.

---

### M05 — Busca por veículo (mobile)

**Layout**

- Tela cheia, 3 selects empilhados + botão Buscar
- Ilustração leve de carro/picape (não caminhão)
- Resultados → M03

**Prompt Stitch**

> Mobile vehicle picker manufacturer model year stacked selectors, search button, light illustration sedan and pickup not heavy truck, auto parts app Portuguese.

---

### M06 — Compartilhar WhatsApp (bottom sheet)

**Layout**

- Sheet 70% altura
- Preview imagem + texto
- Botões: Enviar · Copiar · Cancelar

**Prompt Stitch**

> Mobile bottom sheet share to WhatsApp product preview image and text, send copy cancel buttons auto parts seller app.

---

### M07 — Recentes (tab)

**Layout**

- Lista simples, swipe para remover
- Ícone reconsultar

**Prompt Stitch**

> Mobile recent searches and viewed products list swipe to delete auto parts app tab.

---

### M08 — Catálogos (tab “Mais”)

**Layout**

- Lista com status dot verde/amarelo/vermelho
- Contagem produtos

**Prompt Stitch**

> Mobile catalog sources list status dots product counts auto parts reseller app settings section Portuguese.

---

### M09 — Mais / Configurações mobile

**Layout**

- Perfil vendedor · Loja · Ajuda · Sair
- Versão do app

**Prompt Stitch**

> Mobile more menu settings profile help logout auto parts B2B app simple list Portuguese.

---

### M10 — Scanner de código (fase 1.5 — opcional no Stitch)

**Layout**

- Câmera viewfinder
- Digitar código manualmente link
- Overlay retângulo

**Prompt Stitch**

> Mobile barcode and QR scanner screen for auto parts product code with manual entry link, camera viewfinder overlay Portuguese.

---

## 8. Fluxos críticos (para validar no protótipo)

### Fluxo 1 — Balcão: código → WhatsApp

```text
W02 busca "201.0813" → W03 lista (1 resultado) → W04 detalhe → W10 modal → WhatsApp Web
```

### Fluxo 2 — Piso: veículo → WhatsApp

```text
M02 → M05 Gol 2014 → M03 lista → M04 detalhe → M06 sheet → WhatsApp nativo
```

### Fluxo 3 — Referência cruzada

```text
Busca "PH2870A" → lista → detalhe → tabela refs → copiar / enviar
```

### Fluxo 4 — Gestor confere catálogo novo

```text
W09 → W06 card "Bosch 2026" status Processando → depois OK com contagem
```

---

## 9. Estados e mensagens (copiar nos protótipos)

| Estado | Mensagem PT-BR |
|--------|----------------|
| Loading busca | Buscando no catálogo… |
| Sem resultado | Nenhuma peça encontrada. Tente outro código ou referência. |
| Sem foto | Sem imagem neste catálogo |
| Offline | Sem conexão. Últimos resultados em cache (quando existir). |
| Erro API | Não foi possível consultar. Tente de novo. |
| Catálogo processando | Catálogo ainda sendo atualizado — alguns itens podem faltar |

---

## 10. Checklist Stitch (ordem sugerida)

Gerar nesta ordem para reutilizar componentes:

1. **Design system** — paleta + tipografia + card produto (1 tela referência)
2. **W03 / M03** — lista (componente mais usado)
3. **W04 / M04** — detalhe
4. **W02 / M02** — home busca
5. **W05 / M05** — veículo
6. **W10 / M06** — WhatsApp
7. **W01 / M01** — login
8. **W06–W09 / M07–M09** — admin leve

---

## 11. Prompt “master” (cole uma vez no Stitch)

> Design a complete UI kit and screen set for a **Brazilian auto parts reseller** (B2B counter software), **not** heavy truck market — focus on cars, pickups, vans, SUVs. Web desktop for counter (1440px) and mobile app for floor sellers (390px). Industrial clean UI, dark blue primary, Portuguese Brazil labels. Core flows: search by part code or cross-reference, vehicle fitment search, product detail with photo from cloud catalog, share to WhatsApp. Data: product code, description, brand, catalog source badge (Iguaçu, Kit&Cia, Disauto), cross-reference table, optional vehicle applications. Include: login, home search, results list, product detail, vehicle wizard, catalog status grid, WhatsApp share modal/bottom sheet, settings. High contrast for retail store lighting. Dense product lists for professionals.

---

## 12. Ligação com o projeto técnico atual

| Tela | API / dado futuro |
|------|-------------------|
| Busca | `GET /produtos?q=` ou Supabase RPC + FTS |
| Detalhe | `produtos` + join `fabricantes` |
| Ref. cruzada | `referencias_cruzadas` |
| Foto | URL pública Storage (`foto_url`) |
| Catálogos | tabela `catalogos` |
| WhatsApp | deep link `https://wa.me/?text=` + URL imagem CDN |
| Preço (2.0+) | `estoque_loja.preco_venda` na mensagem WhatsApp |
| Vitrine (2.5+) | link `/loja/{slug}` na mensagem |

**MVP backend já pronto:** ingestão e armazenamento. **MVP frontend (Stitch):** estas telas para validar com Leo/vendedores antes de desenvolver React/Flutter.

**Roadmap produto:** `docs/ROADMAP_MVP.md`

---

## 14. WhatsApp (diferencial do produto)

**Decisão alinhada:** WhatsApp é o **canal principal de venda até o MVP 3.0**. Checkout in-app entra depois; até lá, toda conversão passa por compartilhamento ou botão wa.me.

### Atalhos por superfície

| Onde | Ação | Atalho / implementação |
|------|------|------------------------|
| **Web detalhe (W04)** | Enviar WhatsApp | Botão fixo na barra inferior → abre **W10 modal** |
| **Web modal (W10)** | Abrir conversa | `https://wa.me/55{telefone_loja}?text={encodeURIComponent(msg)}` |
| **Web modal (W10)** | Só copiar | Clipboard API — vendedor cola no WhatsApp manualmente |
| **Mobile detalhe (M04)** | Enviar WhatsApp | Botão verde sticky → **M06 bottom sheet** |
| **Mobile (M06)** | Enviar nativo | `navigator.share()` ou deep link wa.me |
| **Vitrine 2.5** | Cliente pede | wa.me com preço + link da loja (CTA primário) |
| **Teclado web** | Power user | `Ctrl+Shift+W` abre modal WhatsApp (opcional) |

### Template de mensagem — MVP 1.0 (sem preço)

```text
🔧 *{descricao}*
Código: *{codigo_produto_interno}*
Ref.: {numero_produto} · {nome_fabricante}
Catálogo: {origem_catalogo}

{foto_url}
```

### Template de mensagem — MVP 2.0+ (com preço)

```text
🔧 *{descricao}*
Código: *{codigo_produto_interno}*
Ref.: {numero_produto} · {nome_fabricante}

💰 *R$ {preco_venda}* · {quantidade} un. disponível
🏪 {nome_fantasia_loja}

Ver na loja: {url_vitrine}/p/{codigo}
{foto_url}
```

### Regras de UX

1. **WhatsApp sempre visível** — botão primário (verde) em detalhe mobile; barra fixa no web.
2. **Preview antes de enviar** — modal/sheet mostra texto exato; vendedor edita se quiser.
3. **Toggle “incluir foto”** — link CDN da imagem (640 px) no corpo ou anexo via share nativo.
4. **Telefone da loja** — vem de config (W09); fallback para número do vendedor logado.
5. **No 1.0 não exibir preço** — campos de preço só aparecem a partir do 2.0.

### Implementação técnica (referência)

```javascript
function buildWhatsAppUrl(phoneE164, message) {
  const phone = phoneE164.replace(/\D/g, '');
  return `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
}
```

OG tags na vitrine 2.5: `og:title`, `og:image` (foto produto), `og:description` (preço) — preview rico quando o link é colado no WhatsApp.

---

## 13. Próximo passo após Stitch

1. Validar com 1–2 vendedores: “achou em 3 toques?”
2. Priorizar **web busca + detalhe + WhatsApp** vs mobile
3. Implementar API leitura (FastAPI ou PostgREST) com RLS por loja
4. Conectar autenticação (Supabase Auth) multi-tenant revenda
5. Alinhar fases de produto em `docs/ROADMAP_MVP.md`

---

*Arquivo gerado em 21/05/2026 — Projeto Leo · Catálogo consolidado para revendas linha leve/média.*
