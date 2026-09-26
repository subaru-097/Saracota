import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaAdicionarItem } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function inspectDrawerNodes() {
  console.log('=== INSPECIONANDO ELEMENTOS INTERNOS DA GAVETA ABERTA COFEMA ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/', selectors: fornDbRecord?.seletores };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511' });

    // Abrir gaveta
    const cartBtn = page.locator('button[title*="Carrinho de compras"], button[title*="Carrinho"], header button:has(svg)').first();
    if (await cartBtn.isVisible()) {
      await cartBtn.click({ force: true });
      await page.waitForTimeout(2500);
    }

    const drawerNodes = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"], [class*="sheet"], [class*="drawer"], [class*="offcanvas"]') || document.body;
      const elements = Array.from(dialog.querySelectorAll('*')).map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().substring(0, 100),
        class: el.className,
        id: el.id
      })).filter(e => e.text.includes('296511') || e.text.includes('173') || e.text.includes('CHAVE INGLESA') || e.text.includes('R$'));
      return elements.slice(0, 20);
    });

    console.log('Elementos internos da gaveta contendo o produto:\n', JSON.stringify(drawerNodes, null, 2));

  } finally {
    await browser.close();
  }
}

inspectDrawerNodes();
