import { chromium } from 'playwright';
import fs from 'fs';

const cofemaConfig = JSON.parse(fs.readFileSync('core/services/supplier-quote-engine/configs/cofema.json', 'utf8'));
const { cofemaRealizarLogin } = require('../core/services/supplier-quote-engine/cofemaExtractor');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

async function testCardParser() {
  console.log('🧪 Testing Card Parser on Cofema Search Page...\n');

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

  await cofemaRealizarLogin(page, cofemaConfig, { user, pass });

  console.log('Navigating to search page: DUCHA LORENZETTI...');
  await page.evaluate(() => {
    window.location.href = 'https://www.cofema.com.br/page/busca?q=DUCHA%20LORENZETTI';
  });
  await page.waitForTimeout(4000);

  // Test different card selectors
  const parsed = await page.evaluate(() => {
    // Cofema grid uses div cards containing "Adicionar" button
    const addButtons = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').includes('Adicionar'));

    return addButtons.map((btn, idx) => {
      // Find closest card container
      let container: HTMLElement | null = btn.parentElement;
      while (container && container !== document.body) {
        const txt = container.innerText || '';
        if (txt.includes('R$') && (txt.includes('un.') || txt.includes('Abre') || txt.includes('•'))) {
          break;
        }
        container = container.parentElement;
      }

      if (!container) container = btn.parentElement;

      const fullText = container ? container.innerText : '';
      const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

      const skuMatch = fullText.match(/\b(\d{5,8})\b/);
      const sku = skuMatch ? skuMatch[1] : '';

      return {
        idx,
        sku,
        lines: lines.slice(0, 5),
        fullTextSnippet: fullText.substring(0, 150)
      };
    });
  });

  console.log(`Found ${parsed.length} product cards matching "Adicionar" buttons:`);
  console.log(JSON.stringify(parsed.slice(0, 5), null, 2));

  await browser.close();
}

testCardParser().catch(console.error);
