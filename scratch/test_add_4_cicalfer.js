const { chromium } = require('playwright');
const path = require('path');
const { db } = require('../lib/db/client');
const { decryptAES256 } = require('../lib/security/vault');
const quoteEngine = require('../core/services/supplier-quote-engine');
const cicalferConfig = require('../config/suppliers/cicalfer.json');

(async () => {
  const fornDbRecord = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  const loginUser = (fornDbRecord?.emailLogin || fornDbRecord?.login || fornDbRecord?.email || 'santanacomercial2021@gmail.com').trim();
  const rawPass = (fornDbRecord?.rawSenhaCriptografada || fornDbRecord?.senhaLogin || '').trim();
  const decryptedPass = rawPass ? decryptAES256(rawPass).trim() : 'password123';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  console.log('--- 1. Login ---');
  await quoteEngine.realizarLogin(page, cicalferConfig, { user: loginUser, pass: decryptedPass });

  const items = [
    { termo: 'CABO FLEX 100M COBRECOM 2,50MM', quantidade: 2 },
    { termo: 'DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 5 },
    { termo: 'CARRINHO DE MÃO ESFERA EXTRA FORTE 60 LTS', quantidade: 5 },
    { termo: 'DUCHA LORENZETTI TOP JET MULTI 127V', quantidade: 7 }
  ];

  for (let i = 0; i < items.length; i++) {
    console.log(`\n--- Adding Item ${i+1}/${items.length}: "${items[i].termo}" (Qtd: ${items[i].quantidade}) ---`);
    await quoteEngine.adicionarItem(page, cicalferConfig, {
      termo: items[i].termo,
      quantidade: items[i].quantidade,
      itemIndex: i + 1
    });
    console.log('Waiting 3.5s after item addition...');
    await page.waitForTimeout(3500);
  }

  console.log('\n--- Navigating to Carrinho ---');
  await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'commit' });
  await page.waitForTimeout(4000);

  const cartItemsInfo = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]'));
    return containers.map((c, i) => {
      const titleEl = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"]');
      const title = titleEl ? titleEl.innerText.trim() : c.innerText.replace(/\n+/g, ' ');
      const priceEls = Array.from(c.querySelectorAll('.fs-14.fw-bold'));
      const p1 = priceEls[0] ? priceEls[0].innerText.trim() : '';
      const p2 = priceEls[1] ? priceEls[1].innerText.trim() : '';
      const qtyInput = c.querySelector('input');
      const qty = qtyInput ? qtyInput.value : '1';
      return `Item #${i+1}: "${title}" | Qtd: ${qty} | Unit: ${p1} | Total: ${p2}`;
    });
  });

  console.log('\n=== CARRINHO RESULT ===');
  console.log(`Total items in cart: ${cartItemsInfo.length}`);
  cartItemsInfo.forEach(l => console.log(l));

  await browser.close();
})();
