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

  const itemsToTest = [
    { name: 'Item 1 - Cabo Flex', url: 'https://cicalfer.com.br/produtos?pagina=1&busca=CABO%20FLEX%20100M%20COBRECOM%202%2C50MM', qty: 2 },
    { name: 'Item 2 - Ducha Bella', url: 'https://cicalfer.com.br/produtos?pagina=1&busca=DUCHA%20LORENZETTI%20BELLA%20DUCHA%20127V', qty: 5 }
  ];

  for (const item of itemsToTest) {
    console.log(`\nNavigating to search for ${item.name}...`);
    await page.goto(item.url, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    const productLink = page.locator('a[href^="/produto/"]').filter({ hasNotText: '#' }).first();
    if (await productLink.isVisible()) {
      const href = await productLink.getAttribute('href');
      console.log(`Clicking product link: ${href}`);
      await page.goto(`https://cicalfer.com.br${href}`, { waitUntil: 'commit' });
      await page.waitForTimeout(3000);

      const qtyInput = page.locator('input[type="number"], input.QuantidadeMaisMenos_input__grKxO, input').first();
      if (await qtyInput.isVisible()) {
        await qtyInput.fill(String(item.qty));
        await page.waitForTimeout(1000);
      }

      const btnBuy = page.locator('button:has-text("Comprar"), button:has-text("Adicionar"), button[type="submit"]').first();
      if (await btnBuy.isVisible()) {
        console.log(`Clicking Buy button on detail page for ${item.name}...`);
        await btnBuy.click({ force: true });
        await page.waitForTimeout(3500);
      }
    }
  }

  console.log('\n--- Checking Carrinho ---');
  await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  const cartContents = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]'));
    return items.map(i => i.innerText.replace(/\n+/g, ' | '));
  });

  console.log(`TOTAL ITEMS IN CART NOW: ${cartContents.length}`);
  cartContents.forEach((c, idx) => console.log(` [${idx+1}] ${c}`));

  await browser.close();
})();
