import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testDrawerFixOpen() {
  console.log('=== TESTANDO EXTRAÇÃO COM GAVETA ABERTA ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/', selectors: fornDbRecord?.seletores };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    await cofemaLimparCarrinho(page, config);

    console.log('Adicionando 5 un de Chave Inglesa Brasfort (296511)...');
    await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511' });

    // Clicar no botão do carrinho se a gaveta não estiver aberta
    const drawerOpen = await page.locator('[role="dialog"]').first().isVisible({ timeout: 1500 }).catch(() => false);
    if (!drawerOpen) {
      console.log('Abrindo gaveta do carrinho via clique no botão de compras...');
      const cartBtn = page.locator('button[title*="Carrinho de compras"], button[title*="Carrinho"], header button:has(svg)').first();
      if (await cartBtn.isVisible()) {
        await cartBtn.click({ force: true });
        await page.waitForTimeout(2500);
      }
    }

    const screenshotPath = 'scratch/01_carrinho_real_cofema_aberto_confirmado.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Print do carrinho ABERTO salvo em ${screenshotPath}`);

    const cartData = await cofemaExtrairCarrinho(page, config);
    console.log('Carrinho Extraído do DOM:\n', JSON.stringify(cartData, null, 2));

  } finally {
    await browser.close();
  }
}

testDrawerFixOpen();
