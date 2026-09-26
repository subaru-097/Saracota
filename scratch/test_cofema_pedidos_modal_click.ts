import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testPedidosModalClick() {
  console.log('=== TESTANDO ABERTURA DO MODAL DETALHES DO PEDIDO NO PORTAL COFEMA ===');
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
    console.log('1. Login B2B...');
    await cofemaRealizarLogin(page, config, { user, pass });

    console.log('2. Reset do carrinho...');
    await cofemaLimparCarrinho(page, config);

    console.log('3. Adicionando item: Chave Inglesa 12 Brasfort (5 un)...');
    await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511' });

    console.log('4. Clicando no menu Pedidos...');
    const pedidosMenu = page.locator('a[href="/page/pedidos"], a:has-text("Pedidos")').first();
    if (await pedidosMenu.isVisible({ timeout: 4000 }).catch(() => false)) {
      await pedidosMenu.evaluate((el: any) => el.click());
      await page.waitForTimeout(3000);
    } else {
      await page.evaluate(() => {
        const link = document.querySelector('a[href*="pedidos"]') as HTMLAnchorElement;
        if (link) link.click();
      });
      await page.waitForTimeout(3000);
    }

    console.log('URL em pedidos:', page.url());

    // Clicar na aba Carrinhos
    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), [role="tab"]:has-text("Carrinhos")').first();
    if (await tabCarrinhos.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Clicando na aba Carrinhos...');
      await tabCarrinhos.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
    }

    // Clicar no primeiro elemento da tabela de carrinhos
    console.log('Clicando na primeira linha do carrinho ativo...');
    const firstRowCell = page.locator('tbody tr td').first();
    if (await firstRowCell.isVisible({ timeout: 4000 }).catch(() => false)) {
      await firstRowCell.evaluate((el: any) => el.click());
      await page.waitForTimeout(3000);
    }

    const modalText = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]') || document.body;
      return modal.innerText;
    });

    console.log('Texto do Modal/Página:\n', modalText.substring(0, 1500));

    await page.screenshot({ path: 'scratch/01_carrinho_real_cofema_pedidos_detalhes_sucesso.png', fullPage: true });
    console.log('Print de /page/pedidos com detalhes salvo em scratch/01_carrinho_real_cofema_pedidos_detalhes_sucesso.png');

  } catch (err: any) {
    console.error('Erro em pedidos click:', err);
  } finally {
    await browser.close();
  }
}

testPedidosModalClick();
