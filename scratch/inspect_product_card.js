const { chromium } = require('playwright');
const crypto = require('crypto');
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
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  console.log('Logging into Cofema...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
  await entreBtn.click();
  await page.waitForTimeout(1000);

  await page.getByText('Área do Cliente', { exact: true }).first().click();
  await page.waitForTimeout(1000);

  await page.locator('#codigo').fill('43.313.798/0001-34');
  await page.locator('#senha').fill(decryptPass());
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(4000);

  console.log('Searching for BIANCO 900G...');
  const searchInput = page.locator('#input-busca-home, input[type="search"], input[placeholder*="Buscar"]').first();
  await searchInput.fill('BIANCO 900G');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);

  await page.screenshot({ path: 'scratch/inspect_bianco_card.png' });

  const cardDetails = await page.evaluate(() => {
    // Find product card container
    const cards = Array.from(document.querySelectorAll('div[class*="product"], div[class*="Card"], div[class*="card"], div[class*="item"], div.border'));
    
    return cards.map(c => {
      const texts = Array.from(c.querySelectorAll('*')).map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.innerText ? el.innerText.trim() : '',
        id: el.id,
        type: el.type,
        value: el.value || ''
      })).filter(x => x.text || x.tag === 'INPUT' || x.tag === 'BUTTON');
      return { cardClass: c.className, elements: texts };
    }).filter(c => c.elements.some(e => e.text.includes('BIANCO')));
  });

  console.log('Card details found:', JSON.stringify(cardDetails.slice(0, 2), null, 2));

  await browser.close();
})();
