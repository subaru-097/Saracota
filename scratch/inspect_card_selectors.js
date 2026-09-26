const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

function decryptPass() {
  const secret = process.env.ENCRYPTION_KEY || 'saracota_vault_master_key_aes256_32bytes_secret';
  const key = crypto.createHash('sha256').update(secret).digest();
  const enc = '2d9b6e86b1034675062fec1cfdfc46c6:41a8001d9d1eb443aa21bf2b901da8a4';
  const parts = enc.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.locator('button:has-text("Entre ou Cadastre-se")').first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Área do Cliente', { exact: true }).first().click();
  await page.waitForTimeout(1000);

  await page.locator('#codigo').fill('43.313.798/0001-34');
  await page.locator('#senha').fill(decryptPass());
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(4000);

  console.log('Searching BELLA DUCHA 127V...');
  const searchInput = page.locator('#input-busca-home, input[type="search"], input[placeholder*="Buscar"]').first();
  await searchInput.fill('BELLA DUCHA 127V');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);

  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(1000);

  const cardData = await page.evaluate(() => {
    // Find containers that look like product cards
    const allDivs = Array.from(document.querySelectorAll('div'));
    const cards = allDivs.filter(d => d.className.includes('border') && d.querySelector('input') && d.innerText.includes('R$'));

    return cards.map(c => {
      const textLines = c.innerText.split('\n').map(l => l.trim()).filter(Boolean);
      const input = c.querySelector('input');
      const button = c.querySelector('button');

      return {
        cardClass: c.className,
        textLines,
        inputInfo: input ? { tag: input.tagName, type: input.type, value: input.value, class: input.className } : null,
        buttonText: button ? button.innerText.trim() : null
      };
    });
  });

  console.log('Product cards found:', JSON.stringify(cardData, null, 2));

  await browser.close();
})();
