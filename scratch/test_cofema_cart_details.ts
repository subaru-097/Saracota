import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const userCnpj = '43.313.798/0001-34';
const userSenha = 'Santana5419';

const historyDir = path.join(process.cwd(), 'historicos', 'debug_cofema_cart_details');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

async function run() {
  console.log('--- TEST COFEMA CART DETAILS EXTRACTION ---');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // 1. Login
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

    // 2. Click Header Cart Button (Header element 8 - button right before MARIA)
    console.log('--- TEST 1: Click Header Cart Button ---');
    const headerCartBtn = page.locator('header button').nth(8); // or header button with SVG/badge
    const headerBtns = page.locator('header button');
    const count = await headerBtns.count();
    console.log(`Total header buttons: ${count}`);

    // Find the button near MARIA
    for (let i = 0; i < count; i++) {
      const b = headerBtns.nth(i);
      const text = await b.innerText().catch(() => '');
      const cls = await b.getAttribute('class').catch(() => '');
      if (cls.includes('relative h-8') || cls.includes('w-8') || text === '1') {
        console.log(`Clicking header cart button index ${i}...`);
        await b.click({ force: true });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(historyDir, '01_header_cart_clicked.png') });
        break;
      }
    }

    // Check if drawer or overlay opened
    const drawerInfo = await page.evaluate(() => {
      const offcanvas = document.querySelector('.offcanvas, [role="dialog"], div[class*="sheet"], div[class*="drawer"], div.fixed');
      return {
        found: Boolean(offcanvas),
        text: offcanvas ? offcanvas.innerText.substring(0, 1000) : 'NO_OVERLAY',
        html: offcanvas ? offcanvas.outerHTML.substring(0, 1000) : 'NO_OVERLAY_HTML'
      };
    });
    console.log('Drawer Info after header click:', JSON.stringify(drawerInfo, null, 2));

    // 3. TEST 2: Go to /page/pedidos, click "Carrinhos" tab, click row or action button
    console.log('--- TEST 2: /page/pedidos Carrinhos Tab ---');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const carrinhosTab = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos")').first();
    if (await carrinhosTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await carrinhosTab.click({ force: true });
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: path.join(historyDir, '02_pedidos_carrinhos_tab.png') });

    // Inspect row or click action button in the Carrinhos table
    const tableInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr, div[class*="table"] div[class*="row"]'));
      return rows.map(r => ({
        text: r.innerText.trim(),
        actionBtns: Array.from(r.querySelectorAll('button, a, svg')).map(b => ({
          text: b.innerText,
          tag: b.tagName,
          href: b.getAttribute('href') || ''
        }))
      }));
    });
    console.log('Carrinhos Table Rows:', JSON.stringify(tableInfo, null, 2));

    // Click the first row action button or link
    const firstRowLink = page.locator('table tr a, table tr button, div:has-text("#130") a, div:has-text("#130") button').first();
    if (await firstRowLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicking action link/button on cart row...');
      await firstRowLink.click({ force: true });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(historyDir, '03_cart_row_clicked.png') });
    }

    const pageState = await page.evaluate(() => {
      return {
        url: window.location.href,
        bodySnippet: (document.body.innerText || '').substring(0, 1500)
      };
    });
    console.log('Page state after row click:', pageState);

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
