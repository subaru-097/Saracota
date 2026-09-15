/**
 * ETAPA 5: LEITURA E EXTRAÇÃO DO CARRINHO DE COMPRAS (CICALFER)
 * 
 * Trechos extraídos de core/services/supplier-quote-engine/index.js
 * Acessa o carrinho finalizado e extrai com precisão nome do produto,
 * valor unitário, valor total por item, quantidade e valor total geral do pedido.
 */

async function extrairCarrinho(page, config) {
  const sel = config.selectors;
  console.log('[RPA CARRINHO] Navegando para o carrinho para extração dos dados...');
  
  if (!page.url().includes('/carrinho')) {
    await page.goto(sel.cart_url, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  const currentCartUrl = page.url();

  // Aguardar hidratação dos elementos no DOM
  const containerSelector = 'div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]';
  await page.waitForSelector(containerSelector, { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('.fs-14.fw-bold', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Executar a extração diretamente dentro do navegador (browser context)
  const cartData = await page.evaluate(() => {
    function normalizeText(str) {
      return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    }

    // Função de conversão monetária BRL ("R$ 1.234,56" -> 1234.56)
    function parsePrecoBR(valor) {
      if (typeof valor !== 'string' || !valor.trim()) return 0;
      const limpo = valor
        .replace(/[^\d.,]/g, '')   // remove R$, espaços e letras
        .replace(/\./g, '')        // remove ponto separador de milhar
        .replace(',', '.');        // substitui vírgula decimal por ponto

      if (!limpo) return 0;
      const numero = parseFloat(limpo);
      return isNaN(numero) ? 0 : Math.round(numero * 100) / 100;
    }

    const mainContent = document.querySelector('main, #idScrollToTop, body') || document.body;

    // 1. LOCALIZAR CONTAINERS DE CADA ITEM NO CARRINHO
    const itemContainers = Array.from(mainContent.querySelectorAll('div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]'));

    const produtos = [];
    const errosExtracao = [];

    itemContainers.forEach((container, idx) => {
      // a. Nome do Produto (do seletor oficial de título do card)
      let nomeProduto = null;
      const titleEl = container.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], [class*="productTitle"]');
      if (titleEl && titleEl.innerText.trim()) {
        nomeProduto = titleEl.innerText.trim();
      } else {
        const h5OrA = container.querySelector('h5, a');
        if (h5OrA && h5OrA.innerText.trim()) {
          nomeProduto = h5OrA.innerText.trim();
        }
      }

      // b. Preço Unitário (1º .fs-14.fw-bold) e Preço Total (2º .fs-14.fw-bold)
      const priceEls = Array.from(container.querySelectorAll('.fs-14.fw-bold'));
      const rawUnitPriceStr = priceEls[0] ? priceEls[0].innerText.trim() : '';
      const rawTotalItemStr = priceEls[1] ? priceEls[1].innerText.trim() : '';

      let precoUnitario = parsePrecoBR(rawUnitPriceStr);
      let totalItem = parsePrecoBR(rawTotalItemStr);

      // c. Quantidade do input
      const qtyInput = container.querySelector('input[class*="QuantidadeMaisMenos_input"], input[type="number"], input');
      const quantidade = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

      if (totalItem <= 0 && precoUnitario > 0) {
        totalItem = Math.round(precoUnitario * quantidade * 100) / 100;
      }

      // Validação do par (nome + preço)
      if (!nomeProduto || precoUnitario <= 0) {
        errosExtracao.push({
          itemIndex: idx + 1,
          mensagem: `[ERRO EXTRAÇÃO] Falha ao capturar nome/preço no item #${idx + 1}`
        });
        return;
      }

      produtos.push({
        nomeProduto,
        precoUnitario,
        quantidade,
        totalItem,
        rawUnitPriceStr,
        rawTotalItemStr
      });
    });

    // 2. EXTRAÇÃO DA TABELA DE RESUMO DO PEDIDO (table.table-bordered)
    const summaryTable = mainContent.querySelector('table.table-bordered, table');
    let totalItens = 0;
    let despesaAcessoria = 0;
    let totalPedido = 0;
    let resumoTabelaEncontrada = false;

    if (summaryTable) {
      const rows = Array.from(summaryTable.querySelectorAll('tr'));
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td.text-end, td');
        if (th && td) {
          const label = normalizeText(th.innerText);
          const valNum = parsePrecoBR(td.innerText);

          if (label.includes('total itens')) {
            totalItens = valNum;
          } else if (label.includes('despesa') || label.includes('acessoria')) {
            despesaAcessoria = valNum;
          } else if (label.includes('total pedido') || label.includes('total do pedido') || label.includes('total geral')) {
            totalPedido = valNum;
            resumoTabelaEncontrada = true;
          }
        }
      });
    }

    // Fallback de total geral
    if (!resumoTabelaEncontrada || totalPedido <= 0) {
      totalPedido = produtos.reduce((acc, p) => acc + p.totalItem, 0);
      resumoTabelaEncontrada = true;
    }

    return {
      cartUrl: window.location.href,
      containersFoundCount: itemContainers.length,
      produtos,
      errosExtracao,
      resumo: {
        resumoTabelaEncontrada,
        totalItens: totalItens || produtos.reduce((acc, p) => acc + p.totalItem, 0),
        despesaAcessoria,
        totalPedido
      }
    };
  });

  cartData.cartUrl = currentCartUrl;
  return cartData;
}

module.exports = { extrairCarrinho };
