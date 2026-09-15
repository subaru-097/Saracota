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
  await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Scroll several times to ensure all lazy loaded items render
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  const domAnalysis = await page.evaluate(() => {
    const allContainers = Array.from(document.querySelectorAll('*')).filter(el => 
      el.className && typeof el.className === 'string' && el.className.includes('itemContainer')
    );
    return allContainers.map((c, idx) => ({
      index: idx,
      className: c.className,
      innerText: c.innerText.replace(/\n+/g, ' | ')
    }));
  });

  console.log('=== CARRIHO CONTAINER INSPECTION ===');
  console.log(`Found ${domAnalysis.length} containers with "itemContainer" in className`);
  domAnalysis.forEach(c => console.log(`[${c.index}] (${c.className}) => ${c.innerText}`));

  await browser.close();
})();
