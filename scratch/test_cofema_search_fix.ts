import { chromium } from 'playwright';
import fs from 'fs';

const cofemaConfig = JSON.parse(fs.readFileSync('core/services/supplier-quote-engine/configs/cofema.json', 'utf8'));
const { cofemaRealizarLogin } = require('../core/services/supplier-quote-engine/cofemaExtractor');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

async function testSearchFix() {
  console.log('🧪 Testing Search Fixes for Cofema logged-in session...\n');

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
    locale: 'pt-BR',
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  // Step 1: Login
  console.log('Logging in to Cofema...');
  await cofemaRealizarLogin(page, cofemaConfig, { user, pass });
  console.log('Login complete. Current URL:', page.url());

  // METHOD 1: Try window.location.href or in-page navigation to /page/busca?q=300500
  console.log('\n--- METHOD 1: In-page window.location.href navigation ---');
  await page.evaluate((searchTerm) => {
    window.location.href = `https://www.cofema.com.br/page/busca?q=${encodeURIComponent(searchTerm)}`;
  }, 'DUCHA LORENZETTI BELLA DUCHA 220V');
  await page.waitForTimeout(4000);

  console.log('Method 1 URL:', page.url());
  const textM1 = await page.evaluate(() => document.body.innerText);
  console.log('Method 1 text contains "Acesso bloqueado":', textM1.includes('Acesso bloqueado'));
  console.log('Method 1 text snippet:', textM1.substring(0, 400));

  // METHOD 2: Try typing in search input field
  console.log('\n--- METHOD 2: Type in search input field ---');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const searchInput = page.locator('#input-busca-home, input[placeholder*="Buscar"], input[type="search"]').first();
  if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Found search input field!');
    await searchInput.focus();
    await searchInput.fill('');
    await searchInput.type('DUCHA LORENZETTI BELLA DUCHA 220V', { delay: 40 });
    await page.waitForTimeout(500);

    const submitBtn = page.locator('button[type="submit"], button:has-text("Buscar"), .btn-search').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(4000);

    console.log('Method 2 URL:', page.url());
    const textM2 = await page.evaluate(() => document.body.innerText);
    console.log('Method 2 text contains "Acesso bloqueado":', textM2.includes('Acesso bloqueado'));
    console.log('Method 2 text snippet:', textM2.substring(0, 400));
  } else {
    console.log('Search input field NOT visible on homepage!');
  }

  // METHOD 3: Try product page directly: /page/produto/300500
  console.log('\n--- METHOD 3: Direct product page /page/produto/300500 ---');
  await page.evaluate(() => {
    window.location.href = 'https://www.cofema.com.br/page/produto/300500';
  });
  await page.waitForTimeout(4000);
  console.log('Method 3 URL:', page.url());
  const textM3 = await page.evaluate(() => document.body.innerText);
  console.log('Method 3 text contains "Acesso bloqueado":', textM3.includes('Acesso bloqueado'));
  console.log('Method 3 text snippet:', textM3.substring(0, 400));

  await browser.close();
}

testSearchFix().catch(console.error);
