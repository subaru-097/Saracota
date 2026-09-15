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

  await quoteEngine.realizarLogin(page, cicalferConfig, { user: loginUser, pass: decryptedPass });

  console.log('Navigating to Cabo Flex product page...');
  await page.goto('https://cicalfer.com.br/produto/0000000042/cabo-flex-100m-cobrecom-250mm-am-ref-10672', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const buttonsOnPage = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]')).map(b => ({
      tagName: b.tagName,
      className: b.className,
      text: b.innerText.trim(),
      id: b.id
    }));
  });

  console.log('Buttons on product detail page:', JSON.stringify(buttonsOnPage, null, 2));

  await browser.close();
})();
