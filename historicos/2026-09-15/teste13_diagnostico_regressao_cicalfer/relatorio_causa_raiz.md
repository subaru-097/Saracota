# Relatório de Investigação de Causa Raiz — Regressão da Cicalfer (Teste 13)

**Data da Investigação:** 15/09/2026  
**Objetivo:** Diagnosticar com precisão a causa raiz da regressão observada após as alterações do Teste 12, na qual o fornecedor Cicalfer (que antes retornava preços reais e cotação concluída com sucesso) passou a retornar **R$ 0,00** em todos os itens.  
**Modo:** Somente Diagnóstico (Nenhum código do sistema foi alterado nesta etapa).

---

## 1. Mapeamento Completo de Arquivos e Trechos Alterados no Teste 12

Durante o Teste 12, foram modificados 4 arquivos principais no projeto:

### 1.1. `lib/services/automacao/matchingEngine.ts`
- **Remoção do Fallback Fixo para Cicalfer:** Removida a linha que forçava a leitura de `cicalfer.json` quando um fornecedor não tinha arquivo local.
- **Montagem Dinâmica de `activeConfig`:** Adicionado bloco para montar a configuração a partir de `fornDbRecord.seletores` caso não existisse arquivo `.json` local.
- **Alteração de URLs Base Defaults:**
  - Inserida condicional definindo `baseUrl` e `cartUrl`:
    ```typescript
    const baseUrl = fornDbRecord.urlPortalB2B || (isConstruja ? 'https://www.construja.com.br/produtos' : 'https://www.cicalfer.com.br/');
    const cartUrl = isConstruja ? 'https://www.construja.com.br/produtos/carrinho' : 'https://www.cicalfer.com.br/carrinho';
    ```
  - Definido `base_url` do `activeConfig` como `https://www.cicalfer.com.br` (inserindo o subdomínio `www.` para Cicalfer).

### 1.2. `core/services/supplier-quote-engine/index.js` (Motor Central Compartilhado)
- **Alteração na Função `gerarUrlBusca`:**
  - Adicionada regex para limpar `/produtos` do final da `baseUrl`:
    ```javascript
    const rawBase = (config.base_url || config.url_site || 'https://cicalfer.com.br');
    const baseUrl = rawBase.replace(/\/produtos\/?$/i, '').replace(/\/+$/, '');
    ```
- **Alteração no Seletor de Título do Produto (`adicionarItem`):**
  - Modificado o `cardTitleSelector` para buscar `sel.product_card_title || sel.product_title`.
- **Alteração na Navegação e Extração do Carrinho (`extrairCarrinho`):**
  - Adicionado clique prévio em botões de carrinho antes de disparar `page.goto(fullCartUrl)`:
    ```javascript
    const cartBtnSel = sel.abrir_carrinho_button || sel.ver_carrinho_button || '#botao-abrir-carrinho, button[aria-label="Carrinho"], a[href*="carrinho"]';
    ```
  - Alterada a resolução de `cartRelativeUrl`:
    ```javascript
    const cartRelativeUrl = config.cart_url || sel.cart_url || '/carrinho';
    ```
  - Ampliados os seletores de `containerSelector` e `priceSelector`.
  - Adicionada regra de fallback em `page.evaluate` para tentar extrair o valor total via Regex de `R$` no `bodyText` caso a tabela de resumo não fosse localizada.

### 1.3. `core/services/supplier-quote-engine/configs/construja.json`
- Criado/Atualizado o arquivo de configuração da Construjá contendo seletores de login, busca e a URL do carrinho `https://www.construja.com.br/produtos/carrinho`.

### 1.4. `components/features/CotacoesView.tsx`
- Ajustado o filtro de exibição de resultados no frontend de `matchingResults.length <= 5` para correspondência exata `r.fornecedorId === fId`.
- Mapeado o nome dinâmico do fornecedor e a URL dinâmica do carrinho (`dynamicCartUrl`).

---

## 2. Por que a Alteração para a Construjá Impactou a Cicalfer?

A Cicalfer utiliza um arquivo de configuração local próprio (`core/services/supplier-quote-engine/configs/cicalfer.json`), enquanto a Construjá foi configurada para usar seletores dinâmicos ou seu próprio JSON. No entanto, a regressão na Cicalfer ocorreu por **duas causas principais de acoplamento no código compartilhado**:

### Causa A: Inconsistência de Subdomínio (`cicalfer.com.br` vs `www.cicalfer.com.br`)
1. No arquivo `cicalfer.json`, a URL oficial cadastrada e utilizada para login é `https://cicalfer.com.br` (**sem `www.`**).
2. Na alteração feita no `matchingEngine.ts` (linhas ~211-220), a `base_url` default para a Cicalfer foi definida como `https://www.cicalfer.com.br` (**com `www.`**).
3. **Mecanismo da Falha:**
   - O robô faz login em `https://cicalfer.com.br`, gravando os cookies de sessão B2B no domínio sem `www.`.
   - Quando as funções `gerarUrlBusca` ou `extrairCarrinho` executam em seguida, elas navegam para `https://www.cicalfer.com.br/produtos...` ou `https://www.cicalfer.com.br/carrinho`.
   - Como o navegador enxerga `www.cicalfer.com.br` e `cicalfer.com.br` como origens/subdomínios distintos, os cookies de autenticação B2B **não são enviados**.
   - O servidor da Cicalfer detecta uma requisição sem sessão ativa no carrinho e faz um **redirecionamento HTTP 302 automático para `https://cicalfer.com.br/?access=denied`**.

### Causa B: Incompatibilidade na Chave do Seletor do Botão do Carrinho (`view_cart_button`)
1. No arquivo `cicalfer.json` (linha 29), o seletor do botão para abrir o carrinho chama-se **`"view_cart_button"`**:
   ```json
   "view_cart_button": "button#botao-abrir-carrinho, button:has-text(\"Ver carrinho\")"
   ```
2. Na alteração feita no `extrairCarrinho` em `index.js`, foi introduzido o seguinte código:
   ```javascript
   const cartBtnSel = sel.abrir_carrinho_button || sel.ver_carrinho_button || '#botao-abrir-carrinho, button[aria-label="Carrinho"], a[href*="carrinho"]';
   ```
3. **Mecanismo da Falha:**
   - O código em `index.js` buscou pelas propriedades `sel.abrir_carrinho_button` e `sel.ver_carrinho_button`, mas **omitiu a propriedade `sel.view_cart_button`** que é a chave exata gravada no `cicalfer.json`.
   - Como a chave não foi consultada, o robô deixou de clicar no botão do carrinho no DOM (que manteria a sessão SPA intacta) e caiu no fallback `page.goto(fullCartUrl)`.
   - Combinado com o problema do subdomínio `www.`, essa navegação via `page.goto` disparou o redirecionamento `?access=denied`.

---

## 3. Em Qual Etapa Exata do Fluxo o Preço Deixou de ser Extraído/Propagado?

### Ponto Exato de Falha: `extrairCarrinho` (Navegação & Redirecionamento da Página do Carrinho)

1. **Busca e Adição ao Carrinho:** **FUNCIONARAM.**
   - Nos logs do backend (ex: `task-285.log` / `task-1196.log`), confirma-se que o robô buscou e adicionou os produtos na Cicalfer com sucesso:
     - `Produto "DUCHA LORENZETTI BELLA DUCHA 127V..." adicionado ao carrinho com sucesso em Cicalfer (Quantidade: 22).`
     - `Produto "CAIXA D AGUA FECHADA FORTLEV 310L..." adicionado ao carrinho com sucesso em Cicalfer (Quantidade: 3).`

2. **Navegação para o Carrinho:** **FALHOU (Acesso Negado).**
   - Ao chamar `extrairCarrinho`, a URL capturada foi:
     `[QuoteEngine] URL da página do carrinho capturada: "https://cicalfer.com.br/?access=denied"`

3. **Extração de Dados no DOM:** **RETORNOU ZERO.**
   - Ao executar `page.evaluate` dentro de `https://cicalfer.com.br/?access=denied`, a página continha apenas a mensagem de acesso negado.
   - Nenhum container de produto (`itemContainer`) nem tabela de resumo foi localizada.
   - A função retornou `produtos = []` e `totalPedido = 0`.

4. **Tratamento de Exceção no Matching Engine:**
   - Em `matchingEngine.ts` (linha 364), a verificação `if (!resumo.resumoTabelaEncontrada || totalCarrinho <= 0)` detectou `totalCarrinho = 0` e lançou o erro:
     `[ERRO EXTRAÇÃO CICALFER] Tabela de resumo do pedido ou totalPedido não foi localizada na página do carrinho (https://cicalfer.com.br/?access=denied).`

---

## 4. Análise de Logs Silenciosos e Comportamento da Interface

### Por que a UI exibe "MATCH EXATO" e "Cotação concluída", mesmo com valor R$ 0,00?

Há um fluxo de captura e gravação de erros que faz a cotação ser finalizada com status de sucesso na interface, mascarando o erro real de extração:

1. **Captura do Erro em `processarCotacaoFornecedor`:**
   - Quando o erro `[ERRO EXTRAÇÃO CICALFER]` é lançado em `matchingEngine.ts`, o bloco `catch` (linha ~293) é acionado.
   - O `catch` cria um array de itens falhos:
     ```typescript
     const itensFalhos = itensParaCotar.map((it) => ({
       itemPedido: typeof it === 'string' ? it : it.material || it.texto,
       status: 'NAO_ENCONTRADO',
       confianca: 0,
       preco: 0,
       fornecedorId,
     }));
     ```
   - Em seguida, chama `db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensFalhos)`.
   - Essa gravação salva os registros no Supabase com `preco_unitario = 0`.

2. **Finalização do Job no Servidor:**
   - O motor de cotação atualiza o status da cotação no Supabase para `'concluida'` ou `'aguardando_revisao'`.
   - O endpoint `/api/cotacoes/[cotacaoId]/status` passa a responder `status: 'aguardando_revisao'`, `percentualConcluido: 100%`.

3. **Renderização no Frontend (`CotacoesView.tsx` / `CotacoesContext.tsx`):**
   - O frontend faz o polling de status e lê que a cotação foi finalizada no banco.
   - Como os fornecedores selecionados estão na lista de `fornecedores_selecionados`, a UI monta os cards de resumo.
   - O badge "Cotação concluída" é exibido porque `status === 'concluida'`.
   - O selo "MATCH EXATO" é renderizado por regra padrão de visualização de fornecedor ativo com RPA.
   - O valor total do card é calculado somando os itens salvos no banco (`0 + 0`), resultando em **R$ 0,00**.

---

## 5. Linha do Tempo da Causa e Efeito

| Período | Comportamento da Cicalfer | Comportamento da Construjá | Causa Técnica |
| :--- | :--- | :--- | :--- |
| **ANTES do Teste 12** | **FUNCIONAVA** (Preços reais capturados, ex: R$ 44,90 / R$ 143,70) | **FALHAVA** (Retornava R$ 0,00 por cair no fallback fixo do `cicalfer.json`) | Cicalfer usava `https://cicalfer.com.br` (sem `www`), mantendo a sessão de cookies B2B válida. |
| **TESTE 12 (Alteração)** | — | — | • Removido o fallback fixo para `cicalfer.json`.<br>• Alterada `base_url` default em `matchingEngine.ts` para `https://www.cicalfer.com.br` (com `www`).<br>• Alterado `extrairCarrinho` em `index.js` (motor compartilhado), buscando por `abrir_carrinho_button` e ignorando `view_cart_button`. |
| **DEPOIS do Teste 12** | **REGRESSÃO (R$ 0,00)** | **CONTINUA FALHANDO (R$ 0,00)** | • Cicalfer perdeu os cookies de sessão B2B ao navegar para `www.cicalfer.com.br`.<br>• `extrairCarrinho` não encontrou a chave `view_cart_button` e forçou `goto`, sendo redirecionado para `?access=denied`.<br>• Erro capturado silenciosamente gravou `preco: 0` no Supabase, exibindo "Cotação concluída / Total: R$ 0,00" na UI. |

---

## 6. Próximos Passos Recomendados (Apenas para Apreciação)

Para corrigir a regressão da Cicalfer sem impactar a Construjá, as seguintes ações pontuais devem ser avaliadas quando for autorizada a etapa de correção:

1. **Normalização dos Subdomínios B2B:** Garantir em `matchingEngine.ts` e `cicalfer.json` que a URL base da Cicalfer seja estritamente `https://cicalfer.com.br` (sem `www.`).
2. **Harmonização de Chaves de Seletores em `index.js`:** Atualizar a busca de botões de carrinho em `extrairCarrinho` para incluir explicitamente `sel.view_cart_button` (usado pela Cicalfer) ao lado de `sel.abrir_carrinho_button` (usado pela Construjá).
3. **Escopamento de Seletores de Resumo do Carrinho:** Separar seletores de tabela de resumo de cada fornecedor em seus respectivos arquivos `.json` ou no Supabase, evitando regras genéricas que falhem silenciosamente.
