# Relatório de Execução – Teste 14 (Correção de Regressão Cicalfer)

**Data:** 15/09/2026  
**Escopo:** Execução estrita das duas correções autorizadas (URL Base Cicalfer + Seletor do Botão do Carrinho em extrairCarrinho).

---

## 1. Resumo das Alterações Realizadas

### Correção 1 – URL Base da Cicalfer
- **Arquivo:** `lib/services/automacao/matchingEngine.ts`
- **Linhas verificadas/modificadas:** 211, 212 e 220
- **Descrição da Alteração:**
  - Garantido que o fallback/padrão da URL base da Cicalfer no objeto `activeConfig` seja `https://cicalfer.com.br` (SEM o subdomínio `www`), assegurando a retenção adequada de cookies e sessão B2B sem redirecionamento para `?access=denied`.

**Trecho exato do código:**
```typescript
const baseUrl = fornDbRecord.urlPortalB2B || (isConstruja ? 'https://www.construja.com.br/produtos' : 'https://cicalfer.com.br/');
const cartUrl = isConstruja ? 'https://www.construja.com.br/produtos/carrinho' : 'https://cicalfer.com.br/carrinho';
...
base_url: isConstruja ? 'https://www.construja.com.br' : 'https://cicalfer.com.br',
```

---

### Correção 2 – Seletor do Botão do Carrinho (Cicalfer)
- **Arquivo:** `core/services/supplier-quote-engine/index.js`
- **Função:** `extrairCarrinho`
- **Linhas alteradas:** 424, 425 e 426
- **Descrição da Alteração:**
  - Incluída a chave `sel.view_cart_button` no seletor de fallback do botão do carrinho (`cartBtnSel`), além das chaves `sel.botao_abrir_carrinho` e `sel.botao_ver_carrinho`, permitindo que configurações vindas do `cicalfer.json` local ou de seletores cadastrados no Supabase acionem o clique SPA no botão do carrinho.
  - Adicionada verificação por existência no DOM (`count() > 0`) além de `isVisible()`, prevenindo navegações via `page.goto(fullCartUrl)` direta na URL de `/carrinho` que deslogavam a sessão da Cicalfer.

**Diff das linhas alteradas:**
```diff
-  const cartBtnSel = sel.abrir_carrinho_button || sel.ver_carrinho_button || sel.view_cart_button || '#botao-abrir-carrinho, button[aria-label="Carrinho"], a[href*="carrinho"]';
-  const abrirCartBtn = page.locator(cartBtnSel).first();
-  if (await abrirCartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
+  const cartBtnSel = sel.abrir_carrinho_button || sel.ver_carrinho_button || sel.view_cart_button || sel.botao_abrir_carrinho || sel.botao_ver_carrinho || '#botao-abrir-carrinho, button[aria-label="Carrinho"], a[href*="carrinho"]';
+  const abrirCartBtn = page.locator(cartBtnSel).first();
+  const cartBtnExists = (await abrirCartBtn.isVisible({ timeout: 2000 }).catch(() => false)) || ((await abrirCartBtn.count().catch(() => 0)) > 0);
+  if (cartBtnExists) {
```

---

## 2. Confirmação de Restrições

- [x] **`construja.json`**: NÃO alterado.
- [x] **`CotacoesView.tsx`**: Filtro `r.fornecedorId === fId` mantido intacto.
- [x] **`gerarUrlBusca` e `adicionarItem`**: NÃO alterados.
- [x] **`cicalfer.json`**: Chaves mantidas intactas.
- [x] **Outros arquivos**: Nenhum outro arquivo de produção foi modificado ou refatorado.
