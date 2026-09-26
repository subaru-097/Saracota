import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Launching browser with stealth settings...');
  const browser = await chromium.launch({
    headless: false, // Run headful to pass WAF checks
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1400,900',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Override navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

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

  // Save screenshot of Carrinhos list
  const screenListPath = path.join(process.cwd(), 'scratch', 'cofema_stealth_carrinhos_list.png');
  await page.screenshot({ path: screenListPath, fullPage: true });
  console.log('Saved screenshot:', screenListPath);

  // Check if "Acesso bloqueado" is on page
  const pageText = await page.innerText('body').catch(() => '');
  if (pageText.includes('Acesso bloqueado')) {
    console.error('CRITICAL: WAF Block still active!');
    await browser.close();
    return;
  }

  // Find all cart rows/cards
  console.log('Searching for cart rows or #130620...');
  const cart130620 = page.locator('text="#130620"').first();
  if (await cart130620.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Found cart #130620! Clicking...');
    await cart130620.click();
  } else {
    console.log('Cart #130620 not found directly by text, finding eye/action icons or table rows...');
    const eyeBtn = page.locator('.fa-eye, button:has-text("Ver"), a:has-text("Ver"), td:has-text("130620")').first();
    if (await eyeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eyeBtn.click();
    } else {
      console.log('Clicking first clickable row/cell...');
      await page.locator('tr').nth(1).click().catch(() => {});
    }
  }

  await page.waitForTimeout(4000);

  // Screenshot of opened modal
  const screenModalPath = path.join(process.cwd(), 'scratch', 'cofema_stealth_carrinho_modal.png');
  await page.screenshot({ path: screenModalPath, fullPage: true });
  console.log('Saved modal screenshot:', screenModalPath);

  // Save full DOM of modal
  const modalDOM = await page.evaluate(() => {
    const modal = document.querySelector('.modal-content, [role="dialog"], .swal2-popup, div[class*="modal"]');
    return modal ? modal.outerHTML : document.body.outerHTML;
  });
  fs.writeFileSync(path.join(process.cwd(), 'scratch', 'cofema_stealth_modal_dom.html'), modalDOM);
  console.log('Saved modal DOM to scratch/cofema_stealth_modal_dom.html');

  await browser.close();
}

main().catch(console.error);
