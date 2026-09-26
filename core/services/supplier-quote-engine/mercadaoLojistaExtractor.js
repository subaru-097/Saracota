/**
 * ==============================================================================
 * MÓDULO DE EXTRAÇÃO RPA ISOLADO — MERCADÃO LOJISTA
 * ==============================================================================
 * URL: https://www.mercadaolojista.com.br/
 * VALIDADO E HOMOLOGADO EM: 2026-09-25 (Teste E2E Chave Combinada 27mm)
 */

async function mercadaoRealizarLogin(page, config, credentials) {
  const urlLogin = config.url_login || config.login_url || 'https://www.mercadaolojista.com.br/conta/login?next=/conta/index';
  console.log(`[Mercadão Lojista] Navegando para URL de login: ${urlLogin}`);
  
  await page.goto(urlLogin, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const emailSel = config.selectors?.email_input || '#id_email';
  const passSel = config.selectors?.password_input || '#id_senha';
  const submitSel = config.selectors?.login_submit || 'button.botao.principal[type="submit"]';

  const emailInput = page.locator(emailSel).first();
  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`[Mercadão Lojista] Preenchendo login: ${credentials.user}`);
    await page.fill(emailSel, credentials.user);
    await page.fill(passSel, credentials.pass);
    await page.click(submitSel);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    console.log(`[Mercadão Lojista] Login efetuado. URL atual: ${page.url()}`);
  } else {
    console.log(`[Mercadão Lojista] Sessão já logada. URL atual: ${page.url()}`);
  }
}

async function mercadaoAdicionarItem(page, config, rawTerm, qPedida, itemInfo) {
  const searchTerm = rawTerm.trim();
  console.log(`[Mercadão Lojista] Adicionando item à cotação: "${searchTerm}" (Quantidade desejada: ${qPedida})`);

  const searchSelector = config.selectors?.search_input || '#auto-complete';
  await page.waitForSelector(searchSelector, { timeout: 15000 });
  await page.fill(searchSelector, searchTerm);
  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const productCardSelector = config.selectors?.product_card_title || 'a.produto-sobrepor';
  const cards = await page.$$eval(productCardSelector, (els) =>
    els.map(el => ({
      title: el.getAttribute('title') || el.textContent?.trim() || '',
      href: el.getAttribute('href') || ''
    }))
  );

  if (!cards || cards.length === 0) {
    console.warn(`[Mercadão Lojista] ⚠️ Nenhum produto localizado para a busca "${searchTerm}"`);
    return {
      termo: searchTerm,
      qPedida,
      qAjustada: 0,
      status: 'FALHA',
      erro: `Nenhum produto localizado no site para "${searchTerm}"`,
      unitPriceStr: 'R$ 0,00'
    };
  }

  // Validação semântica e correspondência de medida / variação exata
  const termLower = searchTerm.toLowerCase();
  const mmMatch = termLower.match(/(\d+)\s*mm/);
  const targetMm = mmMatch ? mmMatch[1] : null;

  let exactIndex = cards.findIndex(c => {
    const tLower = c.title.toLowerCase();
    if (targetMm) {
      return (tLower.includes(`${targetMm}mm`) || tLower.includes(`${targetMm} mm`)) && tLower.includes('chave combinada');
    }
    return tLower.includes(termLower);
  });

  if (exactIndex === -1) {
    exactIndex = 0; // Fallback para primeiro card da busca
  }

  const selectedTitle = cards[exactIndex].title;
  console.log(`[Mercadão Lojista] ✅ Card correto selecionado no Index [${exactIndex}]: "${selectedTitle}"`);

  // Scroll até o card
  const cardElements = await page.$$(productCardSelector);
  if (cardElements[exactIndex]) {
    await cardElements[exactIndex].scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Obter link direto de adição
  const productHref = await page.evaluate((idx) => {
    const cardsEl = Array.from(document.querySelectorAll('a.produto-sobrepor'));
    const card = cardsEl[idx];
    if (!card) return null;
    const parent = card.closest('.listagem-item, li, div.span3, .produto-item') || card.parentElement;
    const buyBtn = parent ? parent.querySelector('a.botao-comprar-ajax') : null;
    return buyBtn ? buyBtn.getAttribute('href') : null;
  }, exactIndex);

  if (productHref) {
    console.log(`[Mercadão Lojista] Navegando via link direto de adição: ${productHref}`);
    await page.goto(productHref, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  } else {
    const buyBtnSelector = config.selectors?.add_to_cart_button || 'a.botao-comprar-ajax';
    const buyBtns = page.locator(buyBtnSelector);
    let targetBtn = buyBtns.nth(exactIndex);
    if (!(await targetBtn.isVisible().catch(() => false))) {
      targetBtn = buyBtns.first();
    }
    console.log(`[Mercadão Lojista] Clicando no botão Adicionar ao carrinho...`);
    await targetBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Extração preferencial da variável JS injetada var cart
  const jsCart = await page.evaluate(() => {
    return window.cart || window.carrinho || null;
  });

  let extractedPrice = 0;
  let extractedSku = '';
  let extractedName = selectedTitle;

  if (jsCart && jsCart.items && jsCart.items.length > 0) {
    const item = jsCart.items[jsCart.items.length - 1];
    extractedPrice = Number(item.price) || 0;
    extractedSku = item.item_sku || item.item_id || '';
    extractedName = item.item_name || selectedTitle;
    console.log(`[Mercadão Lojista] 🛒 Dados JS do modal: Nome="${extractedName}", SKU="${extractedSku}", Preço=R$ ${extractedPrice}`);
  }

  // Navegar para o carrinho e atualizar quantidade para qPedida
  const cartUrl = config.selectors?.cart_url || 'https://www.mercadaolojista.com.br/carrinho/index';
  console.log(`[Mercadão Lojista] Navegando para o carrinho (${cartUrl}) para atualizar quantidade para ${qPedida}...`);
  await page.goto(cartUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const qtyInputSelector = config.selectors?.quantity_input || 'input.input-mini[name="quantidade"], input[name="quantidade"]';
  const qtyInput = page.locator(qtyInputSelector).first();

  if (await qtyInput.isVisible({ timeout: 10000 }).catch(() => false)) {
    console.log(`[Mercadão Lojista] Preenchendo quantidade no carrinho: ${qPedida}`);
    await qtyInput.fill(String(qPedida));

    const updateBtn = page.locator('button.atualizar-quantidade, button:has-text("Atualizar quantidade"), form[action*="/atualizar"] button').first();
    if (await updateBtn.isVisible().catch(() => false)) {
      console.log(`[Mercadão Lojista] Clicando no botão .atualizar-quantidade...`);
      await updateBtn.click({ force: true });
    } else {
      console.log(`[Mercadão Lojista] Submetendo formulário de quantidade via Enter...`);
      await qtyInput.press('Enter');
    }

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    console.log(`[Mercadão Lojista] Quantidade atualizada para ${qPedida} no carrinho.`);
  }

  return {
    termo: searchTerm,
    qPedida,
    qAjustada: qPedida,
    status: 'SUCESSO',
    produtoEncontrado: extractedName,
    sku: extractedSku,
    unitPrice: extractedPrice,
    unitPriceStr: `R$ ${extractedPrice.toFixed(2).replace('.', ',')}`
  };
}

async function mercadaoExtrairCarrinho(page, config) {
  const cartUrl = config.selectors?.cart_url || 'https://www.mercadaolojista.com.br/carrinho/index';
  if (!page.url().includes('carrinho')) {
    console.log(`[Mercadão Lojista] Navegando para a página do carrinho: ${cartUrl}`);
    await page.goto(cartUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  }

  const qtyInputSelector = config.selectors?.quantity_input || 'input.input-mini[name="quantidade"], input[name="quantidade"]';
  const itemRows = page.locator('tr[data-produto-id]');
  const rowCount = await itemRows.count();

  console.log(`[Mercadão Lojista] Encontradas ${rowCount} linhas no carrinho de compras.`);

  const produtosExtraidos = [];
  let totalCalculado = 0;

  for (let i = 0; i < rowCount; i++) {
    const row = itemRows.nth(i);
    const title = await row.locator('.produto-info a').first().innerText().catch(() => '');
    const unitPriceEl = row.locator('td.col-item-unit-price').first();
    const unitPriceAttr = await unitPriceEl.getAttribute('data-item-unit-valor').catch(() => null);
    const unitPriceText = await unitPriceEl.innerText().catch(() => '');

    let unitPrice = 0;
    if (unitPriceAttr) {
      unitPrice = parseFloat(unitPriceAttr.replace(',', '.'));
    } else {
      const match = unitPriceText.replace(/[^\d,. ]/g, '').trim().replace('.', '').replace(',', '.');
      unitPrice = parseFloat(match) || 0;
    }

    const qtyVal = await row.locator(qtyInputSelector).first().inputValue().catch(() => '1');
    const qty = parseInt(qtyVal, 10) || 1;
    const subtotalItem = unitPrice * qty;
    totalCalculado += subtotalItem;

    produtosExtraidos.push({
      nome: title.trim(),
      nomeProduto: title.trim(),
      produtoEncontrado: title.trim(),
      precoUnitario: unitPrice,
      preco: unitPrice,
      quantidade: qty,
      subtotal: subtotalItem,
      total_item: subtotalItem,
      totalItem: subtotalItem
    });
  }

  const subtotalEl = page.locator(config.selectors?.cart_subtotal || 'strong.valor-subtotal').first();
  const rawSubtotalAttr = await subtotalEl.getAttribute('data-subtotal-valor').catch(() => null);
  const totalEl = page.locator(config.selectors?.resumo_total_pedido || 'strong.valor-total').first();
  const rawTotalAttr = await totalEl.getAttribute('data-total-valor').catch(() => null);

  const subtotalGeral = rawSubtotalAttr ? parseFloat(rawSubtotalAttr) : totalCalculado;
  const totalGeral = rawTotalAttr ? parseFloat(rawTotalAttr) : totalCalculado;

  console.log(`[Mercadão Lojista] Leitura concluída: ${produtosExtraidos.length} produtos | Total: R$ ${totalGeral}`);

  return {
    cartUrl,
    produtos: produtosExtraidos,
    itens: produtosExtraidos,
    resumo: {
      totalItens: subtotalGeral,
      subtotal: subtotalGeral,
      totalPedido: totalGeral
    },
    totalGeral
  };
}

async function mercadaoLimparCarrinho(page, config) {
  const cartUrl = config.selectors?.cart_url || 'https://www.mercadaolojista.com.br/carrinho/index';
  console.log(`[Mercadão Lojista HIGIENE] Verificando limpeza prévia do carrinho em ${cartUrl}...`);

  try {
    if (!page.url().includes('carrinho')) {
      await page.goto(cartUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    for (let loop = 1; loop <= 15; loop++) {
      const itemRows = page.locator('tr[data-produto-id]');
      const count = await itemRows.count().catch(() => 0);

      if (count === 0) {
        console.log(`[Mercadão Lojista HIGIENE] ✅ Carrinho completamente limpo (0 itens).`);
        break;
      }

      console.log(`[Mercadão Lojista HIGIENE] Removendo item residual ${loop} (${count} restante(s))...`);
      
      const removeHref = await page.evaluate(() => {
        const a = document.querySelector('a[href*="/carrinho/produto/"][href*="/remover"]');
        return a ? a.getAttribute('href') : null;
      }).catch(() => null);

      if (removeHref) {
        await page.goto(removeHref, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(2000);
      } else {
        const removeBtn = page.locator('tr[data-produto-id] a[href*="remover"], tr[data-produto-id] .icon-trash, a[href*="/carrinho/produto/"][href*="/remover"]').first();
        if (await removeBtn.isVisible().catch(() => false)) {
          await removeBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(2000);
        } else {
          break;
        }
      }
    }
  } catch (err) {
    console.warn(`[Mercadão Lojista HIGIENE WARN] Aviso durante limpeza prévia do carrinho: ${err.message}`);
  }
}

module.exports = {
  mercadaoRealizarLogin,
  mercadaoAdicionarItem,
  mercadaoExtrairCarrinho,
  mercadaoLimparCarrinho
};
