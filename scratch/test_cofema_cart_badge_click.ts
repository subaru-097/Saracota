import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const userCnpj = '43.313.798/0001-34';
const userSenha = 'Santana5419';

const historyDir = path.join(process.cwd(), 'historicos', 'debug_cart_badge');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

async function run() {
  console.log('--- TEST COFEMA CART BADGE CLICK ---');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
    if (await entreBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await entreBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await page.getByText('Área do Cliente', { exact: true }).first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.locator('#login-cnpj, input[name="login"], input[placeholder*="CNPJ"], input[type="text"]').first().fill(userCnpj);
      await page.locator('#login-senha, input[name="senha"], input[type="password"]').first().fill(userSenha);
      await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
      await page.waitForTimeout(5000);
    }

    // Find cart icon element in header (near MARIA)
    console.log('Finding cart icon element...');
    const cartIconLocator = page.locator('header span:has-text("1"), header div:has-text("1"), header a[href*="carrinho"], header button:has(svg)').first();
    
    // Evaluate header DOM around MARIA
    const headerInfo = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return { error: 'No header' };
      const icons = Array.from(header.querySelectorAll('a, button, div, span')).filter(el => {
        const text = el.innerText ? el.innerText.trim() : '';
        return text === '1' || el.querySelector('svg') || el.className.includes('cart');
      });
      return icons.map((el, i) => ({
        index: i,
        tag: el.tagName,
        text: el.innerText.trim(),
        outerHtml: el.outerHTML.substring(0, 300)
      }));
    });
    console.log('Header Cart Icon Candidates:', JSON.stringify(headerInfo, null, 2));

    // Try clicking the cart badge container
    const badgeEl = page.locator('header').locator('span:has-text("1")').first();
    if (await badgeEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicking cart badge span...');
      await badgeEl.click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(historyDir, '01_badge_clicked.png') });
    }

    // Also try clicking the pencil icon / edit icon or #130620 link on /page/pedidos
    console.log('Navigating to /page/pedidos...');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const carrinhosTab = page.locator('button:has-text("Carrinhos")').first();
    if (await carrinhosTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await carrinhosTab.click({ force: true });
      await page.waitForTimeout(3000);
    }

    // Find edit pencil icon in table row
    const editBtn = page.locator('table tbody tr').first().locator('button, a, svg').nth(1);
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicking edit pencil icon in row...');
      await editBtn.click({ force: true });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(historyDir, '02_edit_pencil_clicked.png') });
    }

    const currentUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 1500));
    console.log('Page URL after edit click:', currentUrl);
    console.log('Page snippet:', pageText);

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
