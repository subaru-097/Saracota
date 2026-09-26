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

  console.log('Logging into Cofema...');
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

  console.log('Searching for BIANCO 900G...');
  const searchInput = page.locator('#input-busca-home, input[type="search"], input[placeholder*="Buscar"]').first();
  await searchInput.fill('BIANCO 900G');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);

  // Scroll down to reveal product cards fully
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'scratch/bianco_card_scrolled.png', fullPage: false });

  const cardHtml = await page.evaluate(() => {
    const card = document.querySelector('div.grid > div, div[class*="grid"] > div, div.border, div.rounded-lg');
    return card ? card.outerHTML : 'No card found';
  });

  fs.writeFileSync('scratch/bianco_card.html', cardHtml);
  console.log('Saved card HTML to scratch/bianco_card.html');

  // Try searching other items with clean terms
  const searchTerms = [
    { name: 'DUCHA LORENZETTI BELLA DUCHA 127V', query: 'BELLA DUCHA 127V' },
    { name: 'DUCHA LORENZETTI MAXI DUCHA 127V', query: 'MAXI DUCHA 127V' },
    { name: 'ALICATE BOMBA D AGUA MTX 10', query: 'ALICATE BOMBA MTX' },
    { name: 'CONDUITE CORR AM FORTLEV 25MM 50M', query: 'CONDUITE FORTLEV 25MM' }
  ];

  for (const st of searchTerms) {
    console.log(`Testing query for ${st.name}: "${st.query}"...`);
    const sInput = page.locator('#input-busca-home, input[type="search"], input[placeholder*="Buscar"]').first();
    await sInput.fill('');
    await sInput.fill(st.query);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const countText = await page.evaluate(() => {
      const h1 = document.querySelector('h1, h2, .text-muted-foreground');
      return h1 ? h1.innerText : '';
    });
    console.log(`   Result count text: "${countText}"`);
  }

  await browser.close();
})();
