import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const userCnpj = '43.313.798/0001-34';
const userSenha = 'Santana5419';

const historyDir = path.join(process.cwd(), 'historicos', 'debug_cofema_click');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

async function run() {
  console.log('--- COFEMA INTERACTION TEST ---');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // 1. Home & Login
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
    if (await entreBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await entreBtn.click({ force: true });
      await page.waitForTimeout(1000);
      const areaClienteLoc = page.getByText('Área do Cliente', { exact: true }).first();
      await areaClienteLoc.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.locator('#login-cnpj, input[name="login"], input[placeholder*="CNPJ"], input[type="text"]').first().fill(userCnpj);
      await page.locator('#login-senha, input[name="senha"], input[type="password"]').first().fill(userSenha);
      await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
      await page.waitForTimeout(5000);
    }

    console.log('Logged in. Search item...');
    const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="Cofema"]').first();
    await searchInput.fill('BELLA DUCHA 127V');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(historyDir, '01_search_page.png') });

    // Find all buttons on the page with text "Adicionar"
    const addButtons = page.locator('button:has-text("Adicionar")');
    const count = await addButtons.count();
    console.log(`Found ${count} buttons with text 'Adicionar'`);

    if (count > 0) {
      console.log('Clicking first Adicionar button...');
      await addButtons.first().click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(historyDir, '02_after_add.png') });
    }

    // Inspect header elements to find cart button / icon
    const headerElements = await page.evaluate(() => {
      const header = document.querySelector('header') || document.body;
      const buttonsAndLinks = Array.from(header.querySelectorAll('button, a, svg')).map(el => ({
        tag: el.tagName,
        text: (el.innerText || '').trim(),
        aria: el.getAttribute('aria-label') || el.getAttribute('title') || '',
        class: el.className ? String(el.className) : ''
      }));
      return buttonsAndLinks;
    });
    console.log('Header buttons/links:', JSON.stringify(headerElements.filter(e => e.text.includes('MARIA') || e.class.includes('cart') || e.aria.includes('carrinho') || e.tag === 'svg'), null, 2));

    // Try clicking cart icon in header (top right next to MARIA)
    const cartIconBtn = page.locator('header button, header a').filter({ hasText: /MARIA/i }).locator('..').locator('button, a, svg').first();
    console.log('Attempting click on header cart area...');
    const allHeaderBtns = page.locator('header button, header a');
    const hCount = await allHeaderBtns.count();
    for (let i = 0; i < hCount; i++) {
      const txt = await allHeaderBtns.nth(i).innerText().catch(() => '');
      const cls = await allHeaderBtns.nth(i).getAttribute('class').catch(() => '');
      console.log(`Header el ${i}: txt="${txt}" cls="${cls}"`);
    }

    // Go to /page/pedidos and check "Carrinhos" tab
    console.log('Navigating to /page/pedidos...');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(historyDir, '03_pedidos_page.png') });

    const carrinhosTab = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos")').first();
    if (await carrinhosTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicking "Carrinhos" tab on /page/pedidos...');
      await carrinhosTab.click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(historyDir, '04_carrinhos_tab.png') });
    }

    const pedidosPageDOM = await page.evaluate(() => {
      const main = document.querySelector('main, #idScrollToTop, body');
      return (main ? main.innerText : '').substring(0, 1500);
    });
    console.log('Pedidos Page Text:', pedidosPageDOM);

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
