const { chromium } = require('playwright');
const path = require('path');
const { db } = require('../lib/db/client');
const { decryptAES256 } = require('../lib/security/vault');
const quoteEngine = require('../core/services/supplier-quote-engine');
const cicalferConfig = require('../config/suppliers/cicalfer.json');

(async () => {
  console.log('=== TESTE DE BUSCA INDIVIDUAL DOS 4 ITENS NA CICALFER ===');

  const fornDbRecord = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  const loginUser = (fornDbRecord?.emailLogin || fornDbRecord?.login || fornDbRecord?.email || 'santanacomercial2021@gmail.com').trim();
  const rawPass = (fornDbRecord?.rawSenhaCriptografada || fornDbRecord?.senhaLogin || '').trim();
  const decryptedPass = rawPass ? decryptAES256(rawPass).trim() : 'password123';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  const itensToTest = [
    { raw: '2 x CABO FLEX 100M COBRECOM 2,50MM', term: 'CABO FLEX 100M COBRECOM 2,50MM' },
    { raw: '5 x DUCHA LORENZETTI BELLA DUCHA 127V', term: 'DUCHA LORENZETTI BELLA DUCHA 127V' },
    { raw: '5 x CARRINHO DE MÃO ESFERA EXTRA FORTE 60 LTS', term: 'CARRINHO DE MÃO ESFERA EXTRA FORTE 60 LTS' },
    { raw: '7 x DUCHA LORENZETTI TOP JET MULTI 127V', term: 'DUCHA LORENZETTI TOP JET MULTI 127V' }
  ];

  try {
    console.log('1. Efetuando login...');
    await quoteEngine.realizarLogin(page, cicalferConfig, { user: loginUser, pass: decryptedPass });

    for (let i = 0; i < itensToTest.length; i++) {
      const item = itensToTest[i];
      console.log(`\n--- BUSCANDO ITEM ${i+1}: "${item.term}" ---`);

      // Garantir navegação para home ou limpeza total antes de buscar
      await page.goto(cicalferConfig.url_site, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const searchInput = page.locator(cicalferConfig.selectors.search_input).first();
      await searchInput.waitFor({ state: 'visible', timeout: 10000 });
      await searchInput.focus();
      await searchInput.press('Control+A');
      await searchInput.press('Backspace');
      await searchInput.fill(item.term);

      await page.locator(cicalferConfig.selectors.search_button).first().click({ force: true });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(4000);

      const searchResult = await page.evaluate(() => {
        const bodyText = document.body ? document.body.innerText.replace(/\n+/g, ' ') : '';
        const cards = Array.from(document.querySelectorAll('.card, .product-card, [class*="product"], [class*="Item"], .col')).slice(0, 5);

        const cardDetails = cards.map(c => {
          const titleEl = c.querySelector('h5, .card-title, span[class*="Title"], a, p');
          const title = titleEl ? titleEl.innerText.trim() : '';
          const prices = Array.from(c.innerText.matchAll(/R\$\s*([\d\.,]+)/g)).map(m => m[0]);
          return { title, prices: prices.slice(0, 2) };
        }).filter(c => c.title && c.title.length > 5);

        return {
          currentUrl: window.location.href,
          cardDetails,
          hasPrices: bodyText.includes('R$')
        };
      });

      console.log(`Resultado busca ${i+1}:`, JSON.stringify(searchResult, null, 2));
    }
  } catch (err) {
    console.error('Erro no teste de busca:', err);
  } finally {
    await browser.close();
  }
})();
