/**
 * ETAPA 4: EXTRAÇÃO DOS DADOS FINAIS DO CARRINHO (CONSTRUJÁ)
 * 
 * Sequência estrita de execução:
 * 1. Abertura do Modal/Gaveta do Carrinho através do botão `#botao-abrir-carrinho` no topo da página
 *    (NÃO navegar para rotas externas inexistentes para preservar o estado SPA da sessão B2B).
 * 2. Aguarde o carregamento do container dos itens (`.ProdutoCompactCarrinho_itemContainer__Eaq76`).
 * 3. Extração no DOM dos seguintes campos de cada item:
 *    - Nome do Produto (`.ProdutoCompactCarrinho_productTitle__n7FXX`)
 *    - Preço Unitário (`.d-flex.flex-column > span.fs-14.fw-bold`)
 *    - Quantidade em Carrinho (`input.QuantidadeMaisMenos_input__grKxO`)
 *    - Preço Total por Item (`.d-flex.flex-column:has(strong:text-is("Total")) span.fs-14.fw-bold`)
 *    - Total Geral do Pedido (`tr:has-text("Total pedido") td.text-end`)
 */

async function extrairGavetaCarrinhoConstruja(page, config) {
  const sel = config.selectors || {};

  console.log('[RPA EXTRAÇÃO CONSTRUJÁ] Abrindo gaveta do carrinho (#botao-abrir-carrinho)...');
  const cartBtn = page.locator(sel.abrir_carrinho_button || '#botao-abrir-carrinho').first();
  if (await cartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cartBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  const containerSel = sel.item_container || '.ProdutoCompactCarrinho_itemContainer__Eaq76';
  await page.waitForSelector(containerSel, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const cartData = await page.evaluate(({ containerSelector, titleSelector, priceSelector }) => {
    function parsePrecoBRL(valor) {
      if (typeof valor !== 'string' || !valor.trim()) return 0;
      const limpo = valor.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
      const num = parseFloat(limpo);
      return isNaN(num) ? 0 : Math.round(num * 100) / 100;
    }

    const items: any[] = [];
    const containers = document.querySelectorAll(containerSelector);

    containers.forEach((container) => {
      const titleEl = container.querySelector(titleSelector || '.ProdutoCompactCarrinho_productTitle__n7FXX, a[href*="/produto/"]');
      const priceEls = Array.from(container.querySelectorAll(priceSelector || '.fs-14.fw-bold, span.fw-bold'));
      const qtyEl = container.querySelector('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]');

      if (titleEl) {
        const prices = priceEls.map(e => (e as HTMLElement).innerText.trim()).filter(t => t.includes('R$') || t.includes(','));
        const unitPriceStr = prices[0] || 'R$ 0,00';
        const totalPriceStr = prices[prices.length - 1] || unitPriceStr;

        items.push({
          produtoEncontrado: (titleEl as HTMLElement).innerText.trim(),
          precoUnitario: parsePrecoBRL(unitPriceStr),
          precoUnitarioFormato: unitPriceStr,
          precoTotalItem: parsePrecoBRL(totalPriceStr),
          precoTotalItemFormato: totalPriceStr,
          quantidade: qtyEl ? Number((qtyEl as HTMLInputElement).value) : 1
        });
      }
    });

    // Extração do valor total do pedido no resumo do carrinho
    let totalPedido = 0;
    const totalRow = Array.from(document.querySelectorAll('tr, table, div')).find(e => (e as HTMLElement).innerText && (e as HTMLElement).innerText.includes('Total pedido'));
    if (totalRow) {
      const txt = (totalRow as HTMLElement).innerText;
      const match = txt.match(/R\$\s*[\d.,]+/);
      if (match) totalPedido = parsePrecoBRL(match[0]);
    }

    return {
      itens: items,
      totalGeralPedido: totalPedido,
      totalItensCount: items.length
    };
  }, {
    containerSelector: containerSel,
    titleSelector: sel.product_title || '.ProdutoCompactCarrinho_productTitle__n7FXX',
    priceSelector: sel.unit_price || '.d-flex.flex-column > span.fs-14.fw-bold'
  });

  console.log(`[RPA EXTRAÇÃO CONSTRUJÁ] Finalizado. Itens extraídos: ${cartData.totalItensCount} | Total Geral: R$ ${cartData.totalGeralPedido}`);
  return cartData;
}

module.exports = { extrairGavetaCarrinhoConstruja };
