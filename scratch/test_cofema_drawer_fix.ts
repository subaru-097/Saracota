import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testDrawerFix() {
  console.log('=== TESTANDO CORREÇÃO DA ABERTURA E EXTRAÇÃO DA GAVETA DO CARRINHO COFEMA ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
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
    console.log('1. Login B2B...');
    await cofemaRealizarLogin(page, config, { user, pass });

    console.log('2. Limpar carrinho...');
    await cofemaLimparCarrinho(page, config);

    console.log('3. Adicionar 5 un de Chave Inglesa Brasfort...');
    const addRes = await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511' });
    console.log('Resultado Adição:', JSON.stringify(addRes, null, 2));

    console.log('4. Extrair carrinho com cofemaExtrairCarrinho...');
    const cartRes = await cofemaExtrairCarrinho(page, config);
    console.log('Resultado Extração Carrinho:\n', JSON.stringify(cartRes, null, 2));

    // Abrir gaveta explicitamente se necessário para screenshot do carrinho real aberto
    const cartIcon = page.locator('header button:has(svg), header a:has(svg), button[title*="Carrinho"]').first();
    if (await cartIcon.isVisible()) {
      await cartIcon.click({ force: true });
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'scratch/01_carrinho_real_cofema_aberto.png', fullPage: true });
    console.log('Screenshot do carrinho real salvo em scratch/01_carrinho_real_cofema_aberto.png');

  } catch (err: any) {
    console.error('Erro no teste de gaveta:', err);
  } finally {
    await browser.close();
  }
}

testDrawerFix();
