import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testDrawerClickReal() {
  console.log('=== TESTANDO CLIQUE REAL NO BOTÃO DO CARRINHO COFEMA ===');
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
    await cofemaLimparCarrinho(page, config);

    console.log('Adicionando 5 un de Chave Inglesa Brasfort (296511)...');
    await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511' });

    console.log('Clicando no botão do carrinho no header...');
    const cartTrigger = page.locator('button[title*="Carrinho de compras"], button[title*="Carrinho"], header button:has(svg)').first();
    if (await cartTrigger.isVisible({ timeout: 4000 })) {
      await cartTrigger.click({ force: true });
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'scratch/01_carrinho_real_cofema_gaveta.png', fullPage: true });
    console.log('Print da gaveta real salvo em scratch/01_carrinho_real_cofema_gaveta.png');

    const cartExtracted = await cofemaExtrairCarrinho(page, config);
    console.log('Carrinho Extraído:\n', JSON.stringify(cartExtracted, null, 2));

  } finally {
    await browser.close();
  }
}

testDrawerClickReal();
