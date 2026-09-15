const { chromium } = require('playwright');
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
    // Wait for autosave request to finish
    await page.waitForResponse(res => res.url().includes('autosave') && res.status() === 200, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  console.log('\n--- Navigating to Carrinho ---');
  await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  // Auto-scroll cart page to hydrate all items
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
    });
  });
  await page.waitForTimeout(2000);

  const cartData = await quoteEngine.extrairCarrinho(page, cicalferConfig);

  console.log('\n====================================================');
  console.log(`TOTAL PRODUCTS IN CART DETECTED: ${cartData.produtos ? cartData.produtos.length : 0}`);
  if (cartData.produtos) {
    cartData.produtos.forEach((p, idx) => {
      console.log(`  Item ${idx+1}: "${p.nomeProduto}" | Qtd: ${p.quantidade} | PrecoUnit: R$ ${p.precoUnitario} | Total: R$ ${p.totalItem}`);
    });
  }
  console.log(`TOTAL GENERAL: R$ ${cartData.resumo?.totalPedido}`);
  console.log('====================================================\n');

  await browser.close();
})();
