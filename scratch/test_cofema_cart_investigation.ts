import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to Cofema portal home...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
  if (await entreBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await entreBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  const areaClienteLoc = page.getByText('Área do Cliente', { exact: true }).first();
  if (await areaClienteLoc.isVisible({ timeout: 5000 }).catch(() => false)) {
    await areaClienteLoc.click({ force: true });
    await page.waitForTimeout(2000);
  }

  const emailInput = page.locator('#codigo').first();
  const passInput = page.locator('#senha').first();

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Filling credentials...');
    await emailInput.fill('compras@saracota.com.br');
    await passInput.fill('SaraCota2026!');
    await page.waitForTimeout(500);

    const submitBtn = page.locator('button:has-text("Entrar")').first();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(5000);
  }

  console.log('2. Navigating to /page/pedidos...');
  await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click on "Carrinhos" tab
  console.log('3. Clicking Carrinhos tab...');
  const tabCarrinhos = page.locator('text="Carrinhos"').first();
  if (await tabCarrinhos.isVisible()) {
    await tabCarrinhos.click();
    await page.waitForTimeout(3000);
  }

  // Take screenshot of Carrinhos list
  const screenListPath = path.join(process.cwd(), 'scratch', 'cofema_carrinhos_list.png');
  await page.screenshot({ path: screenListPath, fullPage: true });
  console.log('Saved screenshot:', screenListPath);

  // Find all cart rows/cards
  const rows = await page.locator('tr, div[class*="row"], div[class*="card"]').all();
  console.log(`Found ${rows.length} rows in list.`);

  // Click on the first active cart row (or cart #130620)
  const cartRow = page.locator('text="#130620"').first();
  if (await cartRow.isVisible()) {
    console.log('Found cart #130620! Clicking...');
    await cartRow.click();
  } else {
    console.log('Cart #130620 not found by text, clicking first row with action icon/view...');
    const firstEye = page.locator('button:has-text("Ver"), a:has-text("Ver"), svg, .fa-eye, td:has-text("#")').first();
    await firstEye.click();
  }
  await page.waitForTimeout(4000);

  // Screenshot of opened modal
  const screenModalPath = path.join(process.cwd(), 'scratch', 'cofema_carrinho_modal.png');
  await page.screenshot({ path: screenModalPath, fullPage: true });
  console.log('Saved modal screenshot:', screenModalPath);

  // Inspect modal DOM content
  const modalHTML = await page.evaluate(() => {
    const modal = document.querySelector('.modal-content, [role="dialog"], .swal2-popup, div[class*="modal"]');
    return modal ? modal.innerHTML : document.body.innerHTML;
  });

  fs.writeFileSync(path.join(process.cwd(), 'scratch', 'cofema_modal_dom.html'), modalHTML);
  console.log('Saved modal DOM HTML to scratch/cofema_modal_dom.html');

  // Parse items from modal
  const parsedItems = await page.evaluate(() => {
    const items: any[] = [];
    const rows = document.querySelectorAll('tr, .item-row, div[class*="item"]');
    rows.forEach((row, idx) => {
      const text = (row as HTMLElement).innerText || '';
      const badge = row.querySelector('.badge, span[class*="badge"], span[class*="tag"]')?.textContent?.trim() || '';
      if (text.includes('R$') || text.includes('UN') || text.includes('CX') || text.includes('KG')) {
        items.push({
          idx,
          badge,
          text: text.replace(/\n+/g, ' | '),
        });
      }
    });
    return items;
  });

  console.log('\n=== PARSED MODAL ITEMS ===');
  console.log(JSON.stringify(parsedItems, null, 2));

  await browser.close();
}

main().catch(console.error);
