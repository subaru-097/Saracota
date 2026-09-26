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

const testQueries = [
  { orig: '6x DUCHA LORENZETTI BELLA DUCHA 127V', terms: ['BELLA DUCHA 127V', 'BELLA DUCHA', 'DUCHA BELLA'] },
  { orig: '4x BIANCO 900G', terms: ['BIANCO 900G', 'BIANCO'] },
  { orig: '7x DUCHA LORENZETTI MAXI DUCHA 127V', terms: ['MAXI DUCHA 127V', 'MAXI DUCHA', 'DUCHA MAXI'] },
  { orig: '12x ALICATE BOMBA D AGUA MTX 10', terms: ['ALICATE BOMBA', 'ALICATE MTX', 'BOMBA D AGUA MTX'] },
  { orig: '5x CONDUITE CORR AM FORTLEV 25MM 50M', terms: ['CONDUITE 25MM', 'CONDUITE FORTLEV', 'FORTLEV 25MM'] }
];

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

  for (const item of testQueries) {
    console.log(`\n=== Testando variações para: ${item.orig} ===`);
    let found = false;

    for (const term of item.terms) {
      const searchInput = page.locator('#input-busca-home, input[type="search"], input[placeholder*="Buscar"]').first();
      await searchInput.fill('');
      await searchInput.fill(term);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3500);

      const title = await page.evaluate(() => {
        // Look for product card titles
        const els = Array.from(document.querySelectorAll('h3, h4, h5, div, a')).filter(el => {
          const txt = el.innerText ? el.innerText.trim() : '';
          return txt.length > 10 && txt.length < 150 && (txt.includes('DUCHA') || txt.includes('BIANCO') || txt.includes('ALICATE') || txt.includes('CONDUITE') || txt.includes('BELLA') || txt.includes('MAXI') || txt.includes('FORTLEV'));
        });
        return els.length > 0 ? els[0].innerText.trim() : null;
      });

      if (title) {
        console.log(`   ✅ SUCESSO com termo "${term}": "${title}"`);
        item.bestTerm = term;
        item.matchedTitle = title;
        found = true;
        break;
      } else {
        console.log(`   ❌ Termo "${term}" não retornou título válido.`);
      }
    }

    if (!found) {
      console.log(`   ⚠️ Nenhuma variação funcionou para: ${item.orig}`);
    }
  }

  await browser.close();
})();
