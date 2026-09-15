const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function tentarAceitarCookies(page) {
  try {
    const botaoCookies = await page.waitForSelector('#botao-aceitar-todos', { timeout: 3000 });
    if (botaoCookies) {
      await botaoCookies.click();
      console.log('[RPA] Banner de cookies detectado e aceito.');
    }
  } catch {
    console.log('[RPA] Nenhum banner de cookies detectado, seguindo cotação.');
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('1. Acessando Cicalfer...');
  await page.goto('https://cicalfer.com.br', { waitUntil: 'commit' });
  await tentarAceitarCookies(page);

  console.log('2. Efetuando Login...');
  await page.goto('https://cicalfer.com.br/login', { waitUntil: 'networkidle' });
  const emailInput = page.locator('input[type="email"], input[name="email"], input#email').first();
  const passInput = page.locator('input[type="password"], input[name="senha"], input#senha').first();

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('financeiro@saracota.com.br');
    await passInput.fill('Sara@2024');
    const btnSubmit = page.locator('button[type="submit"], button:has-text("Entrar")').first();
    await btnSubmit.click();
    await page.waitForTimeout(3000);
  }

  console.log('3. Buscando item "Cabo Flex 2.5mm"...');
  const quoteEngine = require('../core/services/supplier-quote-engine/index.js');
  const cicalferConfig = require('../config/suppliers/cicalfer.json');

  const resItem = await quoteEngine.adicionarItem(page, cicalferConfig, { termo: 'Cabo Flex 2.5mm', quantidade: 1 });

  console.log('Resultado Adicionar Item:', resItem);

  console.log('4. Extraindo carrinho...');
  const cartRes = await quoteEngine.extrairCarrinho(page, cicalferConfig);
  console.log('Resultado Carrinho:', JSON.stringify(cartRes, null, 2));

  await browser.close();
})();
