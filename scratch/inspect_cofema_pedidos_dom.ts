import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function inspectCofemaDom() {
  console.log('=== INSPEÇÃO AO VIVO DO DOM DO PORTAL COFEMA /PAGE/PEDIDOS ===');

  const cofemaFornecedorId = '752e18bd-4f41-414a-8f66-0d8f538de99e';
  const fornDbRecord = await db.fornecedores.getById(cofemaFornecedorId);
  const emailLogin = fornDbRecord?.emailLogin || '';
  const senhaLogin = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada);

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });

  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/' };

  try {
    console.log('1. Efetuando login...');
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    console.log('2. Navegando para /page/pedidos...');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('\n--- TEXTO DO BODY EM /PAGE/PEDIDOS (PRIMEIRA TELA) ---');
    console.log(bodyText.substring(0, 2000));

    console.log('\n3. Clicando na aba Carrinhos se existir...');
    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos")').last();
    if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabCarrinhos.click();
      await page.waitForTimeout(3000);
    }

    const tabText = await page.evaluate(() => document.body.innerText);
    console.log('\n--- TEXTO DO BODY NA ABA CARRINHOS ---');
    console.log(tabText.substring(0, 2000));

    console.log('\n4. Executando cofemaExtrairCarrinho...');
    const cartData = await cofemaExtrairCarrinho(page, config);
    console.log('\n--- RETORNO REAL DO COFEMA EXTRAIR CARRINHO (JSON) ---');
    console.log(JSON.stringify(cartData, null, 2));

  } finally {
    await browser.close();
  }
}

inspectCofemaDom().catch(console.error);
