import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  console.log('Navigating to https://www.cofema.com.br/...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('1. Clicking "Entre ou Cadastre-se"...');
  await page.click('button:has-text("Entre ou Cadastre-se")');
  await page.waitForTimeout(1000);

  console.log('2. Clicking "Área do Cliente"...');
  await page.click('text="Área do Cliente"');
  await page.waitForTimeout(3000);

  // Take screenshot after clicking "Área do Cliente"
  await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'cofema_after_area_cliente.png') });
  console.log('Saved screenshot after clicking Área do Cliente');

  // Check inputs on page
  const inputs = await page.evaluate(() => {
    const arr = Array.from(document.querySelectorAll('input'));
    return arr.map(i => ({
      type: i.type,
      name: i.name,
      id: i.id,
      placeholder: i.placeholder,
      class: i.className,
      visible: (i.offsetParent !== null),
    }));
  });

  console.log('Page inputs:', JSON.stringify(inputs, null, 2));

  // Check buttons
  const btns = await page.evaluate(() => {
    const arr = Array.from(document.querySelectorAll('button'));
    return arr.map(b => ({
      text: b.innerText,
      type: b.type,
      id: b.id,
      class: b.className,
    }));
  });

  console.log('Page buttons:', JSON.stringify(btns, null, 2));

  await browser.close();
}

main().catch(console.error);
