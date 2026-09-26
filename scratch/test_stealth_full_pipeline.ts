import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testStealthFullPipeline() {
  console.log('=== TESTE PIPELINE STEALTH COMPLETO COFEMA ===');
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
    log('1. Login...');
    await cofemaRealizarLogin(page, config, { user, pass });

    log('2. Limpeza do carrinho...');
    await cofemaLimparCarrinho(page, config).catch(e => console.log('Reset warning:', e.message));

    log('3. Adicionando item: Chave Inglesa 12 Brasfort (5 un)...');
    const addRes = await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511' });
    console.log('Resultado AdicionarItem:', JSON.stringify(addRes, null, 2));

    log('4. Extraindo carrinho...');
    const cartRes = await cofemaExtrairCarrinho(page, config);
    console.log('Resultado ExtrairCarrinho:\n', JSON.stringify(cartRes, null, 2));

    // Abrir gaveta se necessário
    const cartBtn = page.locator('button[title*="Carrinho de compras"], button[title*="Carrinho"], header button:has(svg)').first();
    if (await cartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'scratch/01_carrinho_real_cofema_sucesso.png', fullPage: true });
    console.log('Print do carrinho real salvo em scratch/01_carrinho_real_cofema_sucesso.png');

  } catch (err: any) {
    console.error('Erro no pipeline:', err);
  } finally {
    await browser.close();
  }
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

testStealthFullPipeline();
