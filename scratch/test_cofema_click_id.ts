import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaAdicionarItem } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testClickId() {
  console.log('=== TESTANDO CLIQUE DIRETO NO ID # EM /page/pedidos ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/', selectors: fornDbRecord?.seletores };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511' });

    console.log('Navegando para /page/pedidos...');
    await page.evaluate(() => {
      const link = document.querySelector('a[href*="pedidos"]') as HTMLAnchorElement;
      if (link) link.click();
    });
    await page.waitForTimeout(4000);

    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), [role="tab"]:has-text("Carrinhos")').first();
    if (await tabCarrinhos.isVisible()) {
      await tabCarrinhos.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
    }

    console.log('Procurando elementos clicáveis na linha do carrinho...');
    const idCell = page.locator('td:has-text("#"), a:has-text("#"), button:has(svg)').first();
    if (await idCell.isVisible({ timeout: 4000 })) {
      await idCell.evaluate((el: any) => el.click());
      await page.waitForTimeout(3000);
    }

    const screenshotPath = 'scratch/01_carrinho_real_cofema_pedidos_detalhes.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Print salvo em ${screenshotPath}`);

    const modalText = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"], div[class*="modal"]') || document.body;
      return dialog.innerText.substring(0, 1500);
    });

    console.log('Texto do Modal:\n', modalText);

  } finally {
    await browser.close();
  }
}

testClickId();
