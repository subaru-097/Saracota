const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const htmlPath = path.join(process.cwd(), 'diagnostico_cicalfer', '2026-09-09_20-36-07', '06b_carrinho_completo.html');
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

  console.log(`Loading HTML from: ${fileUrl}`);
  await page.goto(fileUrl);

  const cartData = await page.evaluate(() => {
    function converterMoedaParaNumero(str) {
      if (!str) return 0;
      const limpo = str.replace(/R\$/gi, '').replace(/[\s\u00A0]/g, '').trim();
      const normalizado = limpo.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(normalizado);
      return isNaN(val) ? 0 : val;
    }

    // 1. EXTRAÇÃO DOS ITENS
    const items = [];
    const itemContainers = Array.from(document.querySelectorAll('#compra-rapida-carrinho .ProdutoCompactCarrinho_itemContainer__Eaq76, .ProdutoCompactCarrinho_itemContainer__Eaq76'));

    itemContainers.forEach((container, index) => {
      // Badges
      const badges = Array.from(container.querySelectorAll('.badge')).map(b => b.innerText.trim());
      const codigo_badge = badges[0] || null; // ex: "#11145"
      const embalagem = badges[1] || null;    // ex: "EMB:4"

      // Nome do produto
      const titleEl = container.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX');
      const nome = titleEl ? titleEl.innerText.trim() : '';

      // Link e código do produto a partir do href
      const linkEl = container.querySelector('a[href^="/produto/"]');
      const link = linkEl ? linkEl.getAttribute('href') : '';
      let codigo_produto = null;
      if (link) {
        const match = link.match(/\/produto\/([^\/]+)/);
        if (match) {
          codigo_produto = match[1];
        }
      }

      // Preços: .fs-14.fw-bold (1º = unitário, 2º = total)
      const priceEls = Array.from(container.querySelectorAll('.fs-14.fw-bold'));
      const preco_unitario_raw = priceEls[0] ? priceEls[0].innerText.trim() : '';
      const total_item_raw = priceEls[1] ? priceEls[1].innerText.trim() : '';

      const preco_unitario = converterMoedaParaNumero(preco_unitario_raw);
      const total_item = converterMoedaParaNumero(total_item_raw);

      // Quantidade
      const qtyInput = container.querySelector('input.QuantidadeMaisMenos_input__grKxO');
      const quantidade = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

      items.push({
        index: index + 1,
        codigo_produto,
        codigo_badge,
        embalagem,
        nome,
        preco_unitario,
        quantidade,
        total_item,
        link
      });
    });

    // 2. EXTRAÇÃO DO TOTAL GERAL DA PÁGINA
    let valor_total_geral_raw = '';
    const tableRows = Array.from(document.querySelectorAll('tr'));
    for (const row of tableRows) {
      const th = row.querySelector('th');
      if (th && th.innerText.trim().toLowerCase().includes('total pedido:')) {
        const td = row.querySelector('td.text-end, td');
        if (td) {
          valor_total_geral_raw = td.innerText.trim();
          break;
        }
      }
    }

    const valor_total_geral = converterMoedaParaNumero(valor_total_geral_raw);

    return {
      total_itens_count: items.length,
      valor_total_geral_raw,
      valor_total_geral,
      items
    };
  });

  console.log('=== RESULTADO DA EXTRAÇÃO NO HTML REAL ===');
  console.log(JSON.stringify(cartData, null, 2));

  await browser.close();
})();
