import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testPedidosModalStealth() {
  console.log('=== TESTANDO NAVEGAÇÃO STEALTH PARA /page/pedidos E EXTRAÇÃO DO MODAL ===');
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
    console.log('1. Login B2B...');
    await cofemaRealizarLogin(page, config, { user, pass });

    console.log('2. Limpeza do carrinho...');
    await cofemaLimparCarrinho(page, config).catch(e => console.log('Reset warning:', e.message));

    console.log('3. Adicionando item: Chave Inglesa 12 Brasfort (5 un)...');
    const addRes = await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511' });
    console.log('Adição concluída:', JSON.stringify(addRes, null, 2));

    console.log('4. Clicando no link Ver Pedidos ou navegando para /page/pedidos...');
    const pedidosLink = page.locator('a[href="/page/pedidos"], a:has-text("Pedidos")').first();
    if (await pedidosLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pedidosLink.click({ force: true });
      await page.waitForTimeout(3000);
    } else {
      await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
    }

    console.log('URL em pedidos:', page.url());

    // Clicar na aba Carrinhos se visível
    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), [role="tab"]:has-text("Carrinhos"), a:has-text("Carrinhos")').first();
    if (await tabCarrinhos.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Clicando na aba Carrinhos...');
      await tabCarrinhos.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // Clicar no primeiro carrinho / visualização
    const verCarrinhoBtn = page.locator('button:has-text("Ver"), tr:has-text("R$"), svg.lucide-eye').first();
    if (await verCarrinhoBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Clicando para visualizar o carrinho ativo...');
      await verCarrinhoBtn.click({ force: true });
      await page.waitForTimeout(3000);
    }

    const modalVisible = await page.locator('[role="dialog"], div:has-text("Detalhes do Pedido")').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Modal Detalhes do Pedido visível?', modalVisible);

    const screenshotPath = 'scratch/01_carrinho_real_cofema_pedidos_modal.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Print do carrinho real salvo em ${screenshotPath}`);

    const modalContent = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"], div[class*="modal"]') || document.body;
      return modal.innerText.substring(0, 1500);
    });
    console.log('Conteúdo do Modal:\n', modalContent);

  } catch (err: any) {
    console.error('Erro no teste pedidos:', err);
  } finally {
    await browser.close();
  }
}

testPedidosModalStealth();
