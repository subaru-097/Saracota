import { cofemaRealizarLogin, cofemaAdicionarItem, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';
import { chromium } from 'playwright';
import { db } from '../lib/db/client';

async function testWithStealthBrowser() {
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const emailLogin = fornDbRecord?.emailLogin || '';
  const senhaLogin = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada);

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br' };

  try {
    console.log('1. Autenticando com perfil Stealth...');
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    console.log('2. Testando cofemaAdicionarItem...');
    const addRes = await cofemaAdicionarItem(page, config, {
      termo: 'DUCHA LORENZETTI BELLA DUCHA 220V',
      quantidade: 1,
      sku: '300500',
      codigo_fornecedor: '300500'
    });

    console.log('RESULTADO ADICIONAR ITEM:', JSON.stringify(addRes, null, 2));

    console.log('3. Testando cofemaExtrairCarrinho...');
    const cartRes = await cofemaExtrairCarrinho(page, config);
    console.log('RESULTADO CARRINHO:', JSON.stringify(cartRes, null, 2));

  } finally {
    await browser.close();
  }
}

testWithStealthBrowser().catch(console.error);
