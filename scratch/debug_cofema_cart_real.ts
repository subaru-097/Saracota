import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const userCnpj = process.env.COFEMA_LOGIN_CNPJ || '43.313.798/0001-34';
const userSenha = process.env.COFEMA_LOGIN_SENHA || 'Santana5419';

const historyDir = path.join(process.cwd(), 'historicos', 'debug_cofema_cart');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

async function debugCofemaCart() {
  console.log('================================================================');
  console.log('🔍 INVESTIGAÇÃO REAL DO CARRINHO DA COFEMA');
  console.log('================================================================');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // 1. Home
    console.log('--- Step 1: Navigating to Cofema home ---');
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(historyDir, '01_home.png') });

    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 2. Login
    console.log('--- Step 2: Login ---');
    const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
    await entreBtn.waitFor({ state: 'visible', timeout: 10000 });
    await entreBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const areaClienteLoc = page.getByText('Área do Cliente', { exact: true }).first();
    await areaClienteLoc.waitFor({ state: 'visible', timeout: 5000 });
    await areaClienteLoc.click({ force: true });
    await page.waitForTimeout(2000);

    await page.locator('#login-cnpj, input[name="login"], input[placeholder*="CNPJ"], input[type="text"]').first().fill(userCnpj);
    await page.locator('#login-senha, input[name="senha"], input[type="password"]').first().fill(userSenha);
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(historyDir, '02_logged_in.png') });

    // Check post-login URL
    console.log('Post login URL:', page.url());

    // 3. Search & Add Item 1: BELLA DUCHA 127V
    console.log('--- Step 3: Search & Add Bella Ducha ---');
    const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="Cofema"], input[type="search"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill('');
    await searchInput.type('BELLA DUCHA 127V', { delay: 50 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(historyDir, '03_search_bella_ducha.png') });

    // Inspect search cards
    const cardsInfo = await page.evaluate(() => {
      const mainGrid = document.querySelector('main div.grid, div.grid:not(.fixed)');
      if (!mainGrid) return { foundGrid: false };
      const cards = Array.from(mainGrid.children);
      return {
        foundGrid: true,
        count: cards.length,
        items: cards.slice(0, 3).map(c => ({
          textSnippet: (c.innerText || '').substring(0, 150),
          buttons: Array.from(c.querySelectorAll('button')).map(b => b.innerText.trim())
        }))
      };
    });
    console.log('Cards Info:', JSON.stringify(cardsInfo, null, 2));

    // Try adding item 1
    const cardLoc = page.locator('main div.grid > div, main section div.grid > div').first();
    const addBtn = cardLoc.locator('button:has-text("Adicionar"), button:has-text("Comprar")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicking Add button on card 1...');
      await addBtn.click({ force: true });
      await page.waitForTimeout(3000);
    } else {
      console.log('Add button not visible directly on card.');
    }

    await page.screenshot({ path: path.join(historyDir, '04_after_add_click.png') });

    // Check cart drawer or cart icon badge
    const cartState = await page.evaluate(() => {
      const drawer = document.querySelector('#compra-rapida-carrinho, .offcanvas, [class*="carrinho"], [class*="Cart"]');
      const cartBadge = document.querySelector('[class*="badge"], [class*="count"], header a[href*="carrinho"], header button');
      return {
        drawerHtml: drawer ? drawer.outerHTML.substring(0, 500) : 'NO_DRAWER',
        drawerText: drawer ? drawer.innerText.substring(0, 500) : 'NO_DRAWER_TXT',
        cartBadgeText: cartBadge ? cartBadge.innerText : 'NO_BADGE',
        currentUrl: window.location.href
      };
    });
    console.log('Cart State after add click:', JSON.stringify(cartState, null, 2));

    // 4. Try navigating to various possible cart URLs to find where the active cart lives
    const cartUrlsToTest = [
      'https://www.cofema.com.br/carrinho',
      'https://www.cofema.com.br/pedido',
      'https://www.cofema.com.br/cart',
      'https://www.cofema.com.br/page/pedidos',
      'https://www.cofema.com.br/compra-rapida'
    ];

    for (const testUrl of cartUrlsToTest) {
      console.log(`Testing navigation to ${testUrl}...`);
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const urlInfo = await page.evaluate(() => {
        return {
          finalUrl: window.location.href,
          title: document.title,
          bodySnippet: (document.body.innerText || '').substring(0, 300)
        };
      });
      console.log(`Result for ${testUrl}:`, urlInfo);
    }

  } catch (err: any) {
    console.error('Error during debug:', err);
  } finally {
    await browser.close();
  }
}

debugCofemaCart();
