import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCofemaStealthFullCart() {
  console.log('=== TESTE DE NAVEGAÇÃO E EXTRAÇÃO DE CARRINHO COM STEALTH ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
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
    console.log('1. Realizando login B2B com stealth...');
    await cofemaRealizarLogin(page, config, { user, pass });
    console.log('Login concluído. URL:', page.url());

    console.log('2. Limpando carrinho...');
    await cofemaLimparCarrinho(page, config).catch(e => console.log('Reset warning:', e.message));

    console.log('3. Buscando produto via input do header...');
    const searchInput = page.locator('input[placeholder*="buscar" i], input[type="search"], .search-input, input[name="q"], input[placeholder*="pesquisar" i]').first();

    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill('');
      await searchInput.type('Chave Inglesa 12', { delay: 40 });
      await searchInput.press('Enter');
      await page.waitForTimeout(4000);
    } else {
      console.log('Navegando via link de busca...');
      await page.goto('https://www.cofema.com.br/page/busca?q=Chave%20Inglesa%2012', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
    }

    console.log('URL após busca:', page.url());

    // Localizar botão Adicionar e preencher quantidade 5
    const cardElement = page.locator('div, tr, article').filter({ hasText: /CHAVE INGLESA/i }).first();
    if (await cardElement.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Card encontrado! Preenchendo quantidade 5...');
      const qtyInput = cardElement.locator('input[type="number"], input[name*="qtd"]').first();
      if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await qtyInput.fill('5');
        await page.waitForTimeout(500);
      }

      const addBtn = cardElement.locator('button').filter({ hasText: /adicionar|comprar|\+/i }).first();
      if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(3000);
        console.log('Botão adicionar clicado.');
      }
    }

    // 4. Abrir a gaveta do carrinho no header ou ir para /page/pedidos
    console.log('4. Abrindo gaveta do carrinho...');
    const cartTrigger = page.locator('header button:has(svg), header a:has(svg), button[title*="Carrinho"]').first();
    if (await cartTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartTrigger.click({ force: true });
      await page.waitForTimeout(3000);
    }

    // Screenshot da gaveta do carrinho
    await page.screenshot({ path: 'scratch/carrinho_gaveta_cofema.png', fullPage: true });
    console.log('Screenshot do carrinho salvo em scratch/carrinho_gaveta_cofema.png');

    // Extrair itens e total real do DOM
    const cartData = await page.evaluate(() => {
      const drawer = document.querySelector('[role="dialog"], [class*="drawer"], [class*="sheet"], [class*="offcanvas"], div[class*="cart"]') || document.body;
      const text = drawer.innerText || '';
      const prices = Array.from(text.matchAll(/R\$\s*([\d\.,]+)/gi)).map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')));
      return {
        textSnippet: text.substring(0, 1000),
        pricesFound: prices
      };
    });

    console.log('Dados extraídos da gaveta do carrinho:\n', JSON.stringify(cartData, null, 2));

  } catch (err: any) {
    console.error('Erro no teste stealth:', err);
  } finally {
    await browser.close();
  }
}

testCofemaStealthFullCart();
