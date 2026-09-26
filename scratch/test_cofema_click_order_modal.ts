import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testClickOrderModal() {
  console.log('=== TESTANDO ABERTURA DO MODAL DETALHES DO PEDIDO EM /page/pedidos ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/', selectors: fornDbRecord?.seletores };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    await cofemaLimparCarrinho(page, config);

    console.log('Adicionando 5 un de Chave Inglesa Brasfort (296511)...');
    await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511' });

    console.log('Navegando para /page/pedidos...');
    await page.evaluate(() => {
      const link = document.querySelector('a[href*="pedidos"]') as HTMLAnchorElement;
      if (link) link.click();
    });
    await page.waitForTimeout(4000);

    // Clicar na aba Carrinhos
    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), [role="tab"]:has-text("Carrinhos")').first();
    if (await tabCarrinhos.isVisible()) {
      await tabCarrinhos.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
    }

    // Clicar no botão da coluna Ações da primeira linha da tabela
    console.log('Clicando na ação do carrinho ativo...');
    const actionBtn = page.locator('tbody tr button, tbody tr a').first();
    if (await actionBtn.isVisible({ timeout: 4000 })) {
      await actionBtn.evaluate((b: any) => b.click());
      await page.waitForTimeout(3000);
    }

    const modalVisible = await page.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Modal Detalhes do Pedido visível?', modalVisible);

    await page.screenshot({ path: 'scratch/01_carrinho_real_cofema_modal_sucesso.png', fullPage: true });
    console.log('Print do modal aberto salvo em scratch/01_carrinho_real_cofema_modal_sucesso.png');

    const modalText = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') || document.body;
      return dialog.innerText;
    });

    console.log('Texto do Modal Detalhes do Pedido:\n', modalText.substring(0, 2000));

  } finally {
    await browser.close();
  }
}

testClickOrderModal();
