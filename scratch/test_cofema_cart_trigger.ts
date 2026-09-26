import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaAdicionarItem } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCartTrigger() {
  console.log('=== TESTANDO SELETOR EXATO DO BOTÃO DO CARRINHO NO HEADER ===');
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
    await cofemaAdicionarItem(page, config, 'Chave Inglesa 12', 5, { sku: '296511' });

    console.log('Procurando botões do header...');
    const headerButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('header button, header a, button[title*="Carrinho"]')).map(b => ({
        tag: b.tagName,
        title: b.getAttribute('title'),
        ariaLabel: b.getAttribute('aria-label'),
        class: b.className,
        text: (b.innerText || '').trim(),
        html: b.outerHTML
      }));
      return btns;
    });

    console.log('Botões localizados no Header:\n', JSON.stringify(headerButtons, null, 2));

    // Testar acionamento do botão do carrinho
    const cartBtn = page.locator('header button[title*="Carrinho"], header button:has(svg), button[title*="Carrinho de compras"]').first();
    if (await cartBtn.isVisible()) {
      console.log('Clicando no botão do carrinho...');
      await cartBtn.click();
      await page.waitForTimeout(3000);

      // Tirar print da gaveta aberta
      await page.screenshot({ path: 'scratch/gaveta_aberta_real.png', fullPage: true });

      const drawerText = await page.evaluate(() => {
        const drawer = document.querySelector('[role="dialog"], [class*="drawer"], [class*="sheet"], [class*="offcanvas"], div[class*="cart"]') || document.body;
        return drawer.innerText;
      });

      console.log('Texto da gaveta aberta:\n', drawerText.substring(0, 1500));
    }

  } finally {
    await browser.close();
  }
}

testCartTrigger();
