# Pesquisa UX — Melhorias para o Catálogo Industrial

Documento condensado para guiar implementação. Foco: **vendedor de balcão de autopeças (linha pesada)** — rápido, preciso, operacional.

**Contexto:** app web Next.js + Supabase que consolida 100+ catálogos de fornecedores. Sistema legado de referência: **SS Plus v12** (ERP desktop Windows).

**Documentos relacionados:** `Telas_MVP.md`, `docs/ROADMAP_MVP.md`

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
- Descrições técnicas longas e difíceis de comparar
- Falta de foto, aplicação e fabricante reduz confiança
- Alternância entre catálogo, ERP, WhatsApp e memória
- Pressão de tempo com cliente na linha
- Confusão entre peças parecidas (código ou aplicação)

---

## 2. Análise heurística das telas atuais

### O que já funciona
- Navegação clara (sidebar, hierarquia de telas)
- Busca em destaque na home
- Layout limpo e profissional
- Fluxo inicial coerente (busca → orçamento → WhatsApp)
- CRM e configurações adequados para MVP

### Problemas por tela

| Tela | Problema | Impacto |
|------|----------|---------|
| **Busca** | Descrição longa concatenada na coluna principal | Difícil escanear; decisão lenta |
| **Busca** | Coluna `Fabricante` quase sempre vazia (`—`) | Espaço desperdiçado; sensação de dado incompleto |
| **Busca** | Placeholder de foto repetido em todas as linhas | Ruído visual sem ajudar na decisão |
| **Busca** | Coluna `Ação` vazia | Sem CTA claro na linha |
| **Busca** | Chips de catálogo são filtros técnicos, não orientados à tarefa | Menos útil para o vendedor |
| **Início** | Cards de status competem com histórico/atalhos | Prioridade visual errada |
| **Início** | "Consultados recentemente" sem contexto (termo buscado, cliente) | Menos reaproveitamento |
| **Orçamento** | Preço manual sem contexto comercial (margem, validade por item) | Baixa confiança na cotação |
| **Orçamento** | Botões inferiores competem entre si | "Enviar WhatsApp" deveria ser o desfecho principal |
| **Veículo** | Funcionalidade crítica ainda não implementada | Gap frente ao legado |
| **CRM** | Parece lista administrativa | Falta contexto comercial (últimas peças, WhatsApp direto) |

**Diagnóstico geral:** o app está mais "bonito e simples" do que "operacionalmente poderoso" para o balcão.

---

## 3. Gap analysis vs. SS Plus (sistema legado)

O legado é visualmente ultrapassado, mas entrega **densidade operacional**. O vendedor valoriza informação, não estética.

| Capacidade do SS Plus | Valor para o vendedor | Como trazer no app moderno |
|-----------------------|----------------------|----------------------------|
| **Similares e agregados** | Encontrar equivalente quando código original não está disponível | Seção "Equivalências e similares" no detalhe do produto, com grau de confiança (equivalente / similar / agregado) |
| **Estoque por filial/local** | Decisão de fechar venda na hora | Mesmo antes da integração: estados "Estoque não integrado" / "Consultar no ERP". Depois: disponibilidade no resultado |
| **Aplicação por veículo** | Confirmar que a peça serve (Randon, Guerra, Facchini, Krone, ano, eixo) | Seção estruturada de aplicação, não texto concatenado |
| **Códigos técnicos separados** | Código interno, fabricante, pesquisa, marca | Chips copiáveis: `Código interno`, `Código fabricante`, `Referências`, `Equivalentes` |
| **Preço e estoque na mesma tela** | Não precisa alternar sistemas | Mostrar no resultado e no detalhe quando MVP 2.0 integrar |

**Princípio:** clareza visual do app novo + densidade útil do legado.

---

## 4. Recomendações priorizadas

### P0 — Essencial para adoção no balcão

#### 4.1 Reestruturar resultado de busca

Cada linha deve permitir decisão em segundos:

```
┌─────────────────────────────────────────────────────────────────┐
│ [foto]  Pino tensor Randon M24x2                    [EIXOSUL]  │
│         Cód. 525 · Ref. 804062, 478, 5995                      │
│         Aplicação: Randon MOD 2000 / Facchini / Guerra         │
│         [Ver detalhes]  [+ Orçamento]  [Copiar código]         │
└─────────────────────────────────────────────────────────────────┘
```

- Título curto normalizado (não descrição bruta)
- Código principal em destaque
- Chips de referências cruzadas
- Aplicação resumida em uma linha
- Badge do catálogo/fornecedor
- Ações rápidas na linha

**Arquivos prováveis:** `src/app/(app)/busca/page.tsx`, componentes de linha de resultado

#### 4.2 Criar drawer/tela de detalhe do produto

Ao clicar no resultado, abrir visão rica com:

- Identificação principal da peça
- Todos os códigos (chips copiáveis)
- Equivalências e similares
- Aplicações por veículo/equipamento
- Catálogo de origem
- Foto (quando houver)
- Estoque/preço (quando disponível — MVP 2.0)
- Botão "Adicionar ao orçamento"
- Texto original do catálogo (colapsável)

**Arquivos prováveis:** `src/app/(app)/produtos/[id]/page.tsx`, novo componente drawer

#### 4.3 Melhorar legibilidade das descrições

- **Na tabela:** versão normalizada e escaneável
- **No detalhe:** descrição bruta em "Texto original do catálogo"
- Parser para extrair: título, códigos, aplicação, medidas

#### 4.4 Adaptar colunas vazias

- Remover ou substituir `Fabricante` vazio por `Aplicação` ou `Referências`
- Reduzir placeholder de foto quando não houver imagem

#### 4.5 WhatsApp como fluxo principal

Prévia editável antes do envio:

```
Olá, segue orçamento solicitado:

1x Pino tensor Randon M24x2 — cód. 525/804062 — R$ X,XX
Validade: 5 dias
Sujeito à disponibilidade de estoque.

Qualquer dúvida, estou à disposição.
```

**Arquivos prováveis:** `src/lib/whatsapp.ts`, `src/components/orcamento/barra-acoes.tsx`

---

### P1 — Alto impacto (após P0)

| Item | Descrição |
|------|-----------|
| **Busca por código exato** | Priorizar match exato sobre relevância textual; tolerar hífen, espaço, ponto, zeros à esquerda; destacar onde bateu ("Encontrado em referência cruzada") |
| **Autocomplete e histórico** | Sugerir códigos recentes, peças mais buscadas, catálogos, consultas por cliente |
| **Atalhos de teclado** | `/` foca busca · `Enter` busca · setas navegam · `A` adiciona ao orçamento · `W` WhatsApp |
| **Estados vazios** | Sugerir remover hífens, buscar só por código, suporte WhatsApp, registrar "peça não encontrada" |
| **CRM conectado** | Na ficha da oficina: últimos orçamentos, peças mais cotadas, marcas, WhatsApp direto, observações |

---

### P2 — Diferenciação e escala

| Item | Descrição |
|------|-----------|
| **Busca por veículo** | Montadora → Modelo → Ano → Sistema/Conjunto → Peças; + carreta, eixo, suspensão, implemento |
| **Indicadores de confiança** | "Match exato por código" · "Match por referência cruzada" · "Match textual" · "Equivalência sugerida" |
| **Fotos colaborativas** | Loja sobe foto própria ou marca "foto pendente" |
| **Comparação de similares** | 2–3 itens lado a lado: códigos, aplicação, marca, estoque, preço |

---

## 5. Quick wins (alto impacto, baixo esforço)

Implementar primeiro, antes ou em paralelo ao P0:

- [ ] Trocar coluna `Fabricante` vazia por `Aplicação/Referências`
- [ ] Quebrar descrições em título curto + chips de códigos + texto secundário
- [ ] Botão `Adicionar ao orçamento` direto na linha do resultado
- [ ] Destacar match encontrado (código/referência) no resultado
- [ ] Drawer simples de detalhe: Códigos · Aplicação · Similares · Texto original
- [ ] Template de WhatsApp editável e profissional
- [ ] Últimas buscas com termo pesquisado + produto selecionado
- [ ] Reduzir peso visual do placeholder de foto (ícone menor ou ocultar coluna)

---

## 6. Jornadas ideais

### Jornada 1 — Cliente liga pedindo peça por código

```
Cliente liga com código
  → Vendedor pressiona / e digita código
  → Match exato no topo ("encontrado por código")
  → Abre detalhe, confirma aplicação e equivalências
  → Adiciona ao orçamento (quantidade + preço)
  → Seleciona oficina/cliente
  → Revisa mensagem WhatsApp e envia
```

### Jornada 2 — Cliente manda descrição vaga

```
Cliente: "preciso de um pino tensor Randon M24"
  → Busca por descrição
  → Resultados agrupados por peça/aplicação
  → Filtra por catálogo ou aplicação
  → Abre detalhe, compara similares
  → Confirma código mais provável
  → Envia orçamento com observação
```

### Jornada 3 — Peça sem estoque / código alternativo

```
Código original não disponível
  → Busca código original
  → Vê item principal + equivalências
  → Escolhe similar compatível
  → Envia orçamento explicando substituição
```

### Jornada 4 — Cliente recorrente

```
Oficina que já comprou antes
  → Abre CRM ou busca oficina
  → Vê últimas peças cotadas/compradas
  → Reabre orçamento anterior ou adiciona peça recorrente
  → Atualiza preço e envia WhatsApp
```

---

## 7. Checklist de implementação

Ordem sugerida para não bloquear o code review atual:

### Fase A — Quick wins (busca)
- [ ] Parser de descrição (título + códigos + aplicação)
- [ ] Nova estrutura de linha na tabela de busca
- [ ] Coluna `Aplicação/Referências` no lugar de `Fabricante`
- [ ] Botão `+ Orçamento` na linha
- [ ] Destaque de match por código/referência

### Fase B — Detalhe do produto
- [ ] Drawer ou página de detalhe enriquecida
- [ ] Chips copiáveis de códigos
- [ ] Seção de aplicação estruturada
- [ ] Seção de equivalências/similares (quando dados existirem)
- [ ] Texto original colapsável

### Fase C — Orçamento e WhatsApp
- [ ] Template de mensagem editável
- [ ] Prévia antes do envio
- [ ] Vínculo cliente → orçamento mais fluido
- [ ] Observação por item no orçamento

### Fase D — Busca avançada
- [ ] Match exato priorizado
- [ ] Normalização de código (hífen, espaço, zeros)
- [ ] Autocomplete / sugestões
- [ ] Atalhos de teclado
- [ ] Estados vazios melhorados

### Fase E — CRM e histórico
- [ ] Contexto comercial na ficha da oficina
- [ ] Histórico de buscas com termo + produto
- [ ] Últimas peças por cliente

### Fase F — Integrações (MVP 2.0+)
- [ ] Estoque e preço no resultado
- [ ] Busca por veículo
- [ ] Indicadores de confiança do match
- [ ] Comparação de similares

---

## 8. Métricas de sucesso (pós-implementação)

| Métrica | O que medir |
|---------|-------------|
| Tempo até orçamento enviado | Da busca ao WhatsApp enviado |
| Taxa de match na primeira busca | % de buscas que resultam em peça adicionada sem refinamento |
| Uso do detalhe do produto | Cliques em "Ver detalhes" vs. ação direta na linha |
| Erros de peça errada | Feedback do vendedor / devoluções |
| Adoção vs. SS Plus | Vendedor prefere o app novo para consulta diária? |

---

## 9. Direção geral

> O vendedor não precisa de interface "bonita" no sentido genérico. Precisa de uma tela que responda rapidamente:
>
> **É a peça certa? Serve na aplicação? Tem equivalente? Tem estoque/preço? Consigo mandar para o cliente agora?**

A prioridade não é adicionar muitas telas — é **melhorar a qualidade da informação na busca** e criar um **detalhe de produto forte**, porque é ali que a confiança da venda acontece.

---

*Gerado em 02/07/2026 com base na análise das telas do Catálogo Industrial (MVP 1.0) e do sistema legado SS Plus v12.*
