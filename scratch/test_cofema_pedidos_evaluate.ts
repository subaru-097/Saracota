import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testPedidosEvaluate() {
  console.log('=== TESTANDO NAVEGAÇÃO VIA CLIENT-SIDE EVALUATE CLICK EM /page/pedidos ===');
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

    console.log('Navegando via evaluate click para a[href="/page/pedidos"]...');
    const pedidosLink = page.locator('a[href="/page/pedidos"]').first();
    if (await pedidosLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pedidosLink.evaluate((el: any) => el.click());
      await page.waitForTimeout(4000);
    } else {
      console.log('Procurando qualquer link com /page/pedidos...');
      await page.evaluate(() => {
        const link = document.querySelector('a[href*="pedidos"]') as HTMLAnchorElement;
        if (link) link.click();
      });
      await page.waitForTimeout(4000);
    }

    console.log('URL após navegação:', page.url());

    // Clicar na aba Carrinhos
    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), [role="tab"]:has-text("Carrinhos"), a:has-text("Carrinhos")').first();
    if (await tabCarrinhos.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Clicando na aba Carrinhos...');
      await tabCarrinhos.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
    }

    // Clicar no botão/linha do carrinho ativo
    const cartRow = page.locator('tr:has-text("R$"), button:has-text("Ver"), div:has-text("Carrinho")').first();
    if (await cartRow.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Clicando para abrir Detalhes do Pedido...');
      await cartRow.evaluate((el: any) => el.click());
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'scratch/01_carrinho_real_cofema_pedidos_aberto.png', fullPage: true });
    console.log('Print de /page/pedidos salvo em scratch/01_carrinho_real_cofema_pedidos_aberto.png');

    const modalText = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]') || document.body;
      return modal.innerText.substring(0, 1500);
    });
    console.log('Texto do Modal:\n', modalText);

  } catch (err: any) {
    console.error('Erro no evaluate click:', err);
  } finally {
    await browser.close();
  }
}

testPedidosEvaluate();
