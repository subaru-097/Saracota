import { chromium } from 'playwright';
import fs from 'fs';

const cofemaConfig = JSON.parse(fs.readFileSync('core/services/supplier-quote-engine/configs/cofema.json', 'utf8'));
const { cofemaRealizarLogin } = require('../core/services/supplier-quote-engine/cofemaExtractor');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

async function testSkuSearch() {
  console.log('🧪 Testing SKU 300500 search on Cofema...\n');

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

  console.log('Logging in to Cofema...');
  await cofemaRealizarLogin(page, cofemaConfig, { user, pass });

  // TEST A: Search by SKU "300500"
  console.log('\n--- TEST A: Search by SKU 300500 ---');
  await page.evaluate(() => {
    window.location.href = 'https://www.cofema.com.br/page/busca?q=300500';
  });
  await page.waitForTimeout(4000);

  const textA = await page.evaluate(() => document.body.innerText);
  console.log('SKU 300500 text snippet:', textA.substring(0, 600));

  // Count product cards and inspect Add button
  const addBtnCountA = await page.locator('button:has-text("Adicionar")').count();
  console.log('Add buttons count for SKU 300500:', addBtnCountA);

  // TEST B: Search by sanitized short term "DUCHA LORENZETTI"
  console.log('\n--- TEST B: Search by "DUCHA LORENZETTI" ---');
  await page.evaluate(() => {
    window.location.href = 'https://www.cofema.com.br/page/busca?q=DUCHA%20LORENZETTI';
  });
  await page.waitForTimeout(4000);

  const textB = await page.evaluate(() => document.body.innerText);
  console.log('"DUCHA LORENZETTI" text snippet:', textB.substring(0, 600));
  const addBtnCountB = await page.locator('button:has-text("Adicionar")').count();
  console.log('Add buttons count for "DUCHA LORENZETTI":', addBtnCountB);

  await browser.close();
}

testSkuSearch().catch(console.error);
