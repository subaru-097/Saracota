const { chromium } = require('playwright');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

(async () => {
  const fornDbRecord = await db.fornecedores.getById('a1684c4d-d896-4ba9-a591-cda455c5ffe2');
  const user = (fornDbRecord.emailLogin || fornDbRecord.login || fornDbRecord.email).trim();
  const pass = decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada).trim();

  console.log('Logging in to Construja as:', user);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Login
  const loginTrigger = page.locator('#botao-login').first();
  if (await loginTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginTrigger.click();
    await page.waitForTimeout(1000);
  }
  await page.locator('input[name="email"]').first().fill(user);
  await page.locator('input#senha').first().fill(pass);
  await page.locator('button#btn-entrar').first().click();
  await page.waitForTimeout(4000);

  console.log('Post login URL:', page.url());

  // Search product
  await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=Ducha%20Lorenzetti', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click buy/add
  const addBtn = page.locator('button:has-text("Comprar"), button:has-text("Adicionar"), button.btn-primary').first();
  if (await addBtn.isVisible().catch(() => false)) {
    console.log('Clicking Add button...');
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Navigate to cart
  console.log('Navigating to cart...');
  await page.goto('https://www.construja.com.br/produtos/carrinho', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  console.log('Final Cart Page URL:', page.url());
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Cart Page Text:\n', bodyText.substring(0, 1000));

  await page.screenshot({ path: 'scratch/construja_cart_debug.png' });
  await browser.close();
})();
