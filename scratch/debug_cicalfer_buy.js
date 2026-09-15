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

  page.on('request', req => {
    if (req.url().includes('api') || req.url().includes('cart') || req.url().includes('carrinho') || req.method() === 'POST') {
      console.log(`[HTTP REQUEST] ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('api') || res.url().includes('cart') || res.url().includes('carrinho') || res.request().method() === 'POST') {
      console.log(`[HTTP RESPONSE ${res.status()}] ${res.url()}`);
    }
  });

  console.log('--- Login ---');
  await quoteEngine.realizarLogin(page, cicalferConfig, { user: loginUser, pass: decryptedPass });

  console.log('\n--- Searching Item 1 (Cabo Flex) ---');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=CABO%20FLEX%20100M%20COBRECOM%202%2C50MM', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  const qtyInput = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
  console.log('Filling Qty 2...');
  await qtyInput.fill('2');
  await page.waitForTimeout(1000);

  console.log('Pressing Enter on Qty Input...');
  await qtyInput.press('Enter');
  await page.waitForTimeout(3000);

  const btnBuy = page.locator('button:has-text("Comprar"), button:has-text("Adicionar"), button.btn-adicionar, button[type="submit"]').first();
  if (await btnBuy.isVisible()) {
    console.log(`Button Buy Text: "${await btnBuy.innerText()}"`);
    await btnBuy.click({ force: true });
    await page.waitForTimeout(3000);
  }

  console.log('\n--- Checking Carrinho ---');
  await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  const items = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]'))
      .map(c => c.innerText.replace(/\n+/g, ' | '));
  });
  console.log('Cart Items after Item 1:', items);

  await browser.close();
})();
