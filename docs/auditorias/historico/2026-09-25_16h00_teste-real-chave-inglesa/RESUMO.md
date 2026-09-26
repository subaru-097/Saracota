# Relatório de Auditoria Comparativa E2E — Execução 2026-09-25 16h00

**CotacaoId**: `afa9858b-15ad-400f-94f6-c1c94393f57f`  
**Item Cotado**: `Chave Inglesa 12 Brasfort` (Qtd: 5)  
**Diretório de Evidências**: `docs/auditorias/historico/2026-09-25_16h00_teste-real-chave-inglesa/`

---

## 1. Respostas aos Questionamentos do Usuário

### a) Seletores CSS Exatos Utilizados Hoje para Captura do Nome do Produto

- **COFEMA**:
  - **Grid de Busca / Cards**: `.product-title, .card-title, h3, a[href*="/produto/"], span.name, div[class*="title"], div[class*="nome"]` dentro do contêiner do produto.
  - **Sanitização de Título**: Aplicado filtro de expressões regulares ignorando botões de UI (`Abre`, `Fechar`, `Detalhes`, `Excluir`, `Voltar`, `Carrinho`, `Adicionar`, `Comprar`) e marcadores de unidade/embalagem (`/^\d+\s*(?:un|pcs|pc|cx|emb|m|kg)\.?$/i`). Além disso, linhas que iniciam com o código/SKU (ex: `Código: 296503 - ...`) têm o prefixo `Código: 296503` removido antes de determinar o título, garantindo que o nome do produto (`CHAVE INGLESA BRASFORT CROMADA 12 8220`) seja capturado sem poluição.
  - **Carrinho Modal (`/page/pedidos`)**: `[role="dialog"]` lendo a linha sanitizada vinculada ao SKU do item.

- **CICALFER**:
  - **Grid de Busca**: `span.ProdutoCard_title__1Fm0w`, `a[href*="/produto/"]` e `.ProdutoCard_price__...`.
  - **Carrinho Lateral / Offcanvas**: `span.ProdutoCompactCarrinho_productTitle__n7FXX` e `a.p-0[href*="/produto/"]`.

- **CONSTRUJÁ**:
  - **Grid de Busca**: `.ProdutoCompactCarrinho_productTitle__n7FXX`, `a[href*="/produto/"]` e `div[class*="productTitle"]`.
  - **Carrinho Drawer**: `.ProdutoCompactCarrinho_productTitle__n7FXX` com botões de remoção `button[title="Remover item"]` e botão global de esvaziamento `svg.fa-trash.acoes-perigo-color`.

---

### b) Reset do Carrinho (Higiene Prévia Universal)

Foi implementada e validada a função universal `limparCarrinho` que executa a limpeza dos itens residuais no portal da **Construjá** (assim como Cofema e Cicalfer) antes de cada cotação.
- No teste de hoje, a Construjá expurgou 15 itens residuais provenientes de sessões passadas (ex: Lorenzetti Ducha Bella), garantindo um carrinho limpo sem contaminação.

---

### c) Consistência da Trava de Integridade Semântica

A trava de integridade no motor central (`matchingEngine.ts`) exige que **todos** os fornecedores passem pela verificação semântica do DOM real do carrinho.
- **Cicalfer**: A busca de ferramentas manuais no catálogo elétrico retornou 0 produtos, o carrinho permaneceu com 0 itens e a trava abortou com `sucesso: false`.
- **Cofema** e **Construjá**: Verificados com correspondência semântica e `sucesso: true`.

---

### d) Exatidão Matemática dos Valores (Zero Divergência)

| Fornecedor | Status | Qtd | Preço Unitário | Total Item | Total Itens (Resumo) | Total Pedido / Geral | Igualdade Matemática |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Cofema** | `CONFIRMADO` | 5 | R$ 69,70 | R$ 348,50 | R$ 348,50 | R$ 348,50 | ✅ **MATEMATICAMENTE IDÊNTICO** |
| **Cicalfer** | `NAO_ENCONTRADO` | 0 | R$ 0,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | ❌ **ABORTADO (`sucesso: false`)** |
| **Construjá** | `CONFIRMADO` | 5 | R$ 60,99 | R$ 304,95 | R$ 304,95 | R$ 304,95 | ✅ **MATEMATICAMENTE IDÊNTICO** |

---

## 2. Evidências Geradas na Pasta de Auditoria

1. [`execucao_raw.log`](file:///c:/Users/User/Desktop/Saracota/docs/auditorias/historico/2026-09-25_16h00_teste-real-chave-inglesa/execucao_raw.log) — Log bruto sem cortes.
2. [`raw_matching_json.json`](file:///c:/Users/User/Desktop/Saracota/docs/auditorias/historico/2026-09-25_16h00_teste-real-chave-inglesa/raw_matching_json.json) — Objeto JSON passado para `salvarResultadosMatching`.
3. `carrinho_real_cofema.png` — Screenshot do carrinho real do portal Cofema.
4. `02_carrinho_real_cicalfer.png` — Screenshot do carrinho real do portal Cicalfer.
5. `03_carrinho_real_construja.png` — Screenshot do carrinho real do portal Construjá.
6. `04_modal_resumo_saracota.png` — Screenshot da interface Saracota em `http://localhost:3000/cotacoes/afa9858b-15ad-400f-94f6-c1c94393f57f`.
