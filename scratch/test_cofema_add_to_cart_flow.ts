import { chromium } from 'playwright';
import fs from 'fs';

const cofemaConfig = JSON.parse(fs.readFileSync('core/services/supplier-quote-engine/configs/cofema.json', 'utf8'));
const { cofemaRealizarLogin, cofemaExtrairCarrinho } = require('../core/services/supplier-quote-engine/cofemaExtractor');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

async function testAddToCartFlow() {
  console.log('🧪 Testing Add to Cart and Cart Extraction for SKU 300500...\n');

  const forn = (await db.fornecedores.list()).find((f: any) => f.slug === 'cofema' || f.nome.toLowerCase().includes('cofema'));
  const user = forn.emailLogin || forn.login || forn.email;
  const pass = forn.rawSenhaCriptografada ? decryptAES256(forn.rawSenhaCriptografada) : (forn.senhaLogin || forn.senha_login);

  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
  } catch (e) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });

  const page = await context.newPage();

  console.log('1. Logging in...');
  await cofemaRealizarLogin(page, cofemaConfig, { user, pass });

  console.log('2. Navigating to SKU 300500 search...');
  await page.evaluate(() => {
    window.location.href = 'https://www.cofema.com.br/page/busca?q=300500';
  });
  await page.waitForTimeout(4000);

  // Find the exact card for 300500
  console.log('3. Locating Add button for SKU 300500...');
  const cardLocator = page.locator('div').filter({ hasText: '300500' }).filter({ hasText: 'DUCHA LORENZETTI BELLA DUCHA' }).first();
  const addBtn = cardLocator.locator('button:has-text("Adicionar")').first();

  if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Clicking "Adicionar" button...');
    await addBtn.click({ force: true });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'scratch/cofema_add_clicked.png' });

    // Check if quantity modal or offcanvas appeared, or input
    const dialog = page.locator('[role="dialog"], div.offcanvas, div[class*="modal"]').first();
    console.log('Dialog visible after Add click:', await dialog.isVisible({ timeout: 2000 }).catch(() => false));
    if (await dialog.isVisible()) {
      const dialogText = await dialog.innerText();
      console.log('Dialog innerText snippet:', dialogText.substring(0, 300));
    }
  } else {
    console.log('Add button not found on 300500 card!');
  }

  // 4. Extract Cart
  console.log('\n4. Extracting Cart from /page/pedidos...');
  const cartRes = await cofemaExtrairCarrinho(page, cofemaConfig);
  console.log('Cart Extracted Result:', JSON.stringify(cartRes, null, 2));

  await browser.close();
}

testAddToCartFlow().catch(console.error);
