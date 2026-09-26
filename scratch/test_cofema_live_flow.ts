import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaAdicionarItem, cofemaExtrairCarrinho, cofemaLimparCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testLiveCofema() {
  console.log('=== TESTE AO VIVO: FLUXO COFEMA ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  console.log(`Credenciais Cofema: ${user} / ${pass}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/', selectors: fornDbRecord?.seletores };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    console.log('Login OK, limpando carrinho...');
    await cofemaLimparCarrinho(page, config);

    console.log('Adicionando item: Chave Inglesa 12 Brasfort SKU 296511 (5 un)...');
    const addRes = await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511', skuFornecedor: '296511' });
    console.log('Resultado de cofemaAdicionarItem:', JSON.stringify(addRes, null, 2));

    console.log('Extraindo carrinho via cofemaExtrairCarrinho...');
    const cartRes = await cofemaExtrairCarrinho(page, config);
    console.log('Resultado de cofemaExtrairCarrinho:', JSON.stringify(cartRes, null, 2));

    console.log('Capturando HTML da gaveta/página de carrinho para diagnóstico...');
    const drawerHtml = await page.evaluate(() => {
      const drawer = document.querySelector('[role="dialog"], [class*="drawer"], [class*="sheet"], [class*="offcanvas"], div[class*="cart"]') || document.body;
      return drawer.outerHTML.substring(0, 3000);
    });
    console.log('Drawer HTML Snippet:\n', drawerHtml);

  } catch (err: any) {
    console.error('Erro no teste Cofema:', err);
  } finally {
    await browser.close();
  }
}

testLiveCofema();
