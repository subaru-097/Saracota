import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import fs from 'fs';
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

  console.log('Clicking "Entre ou Cadastre-se"...');
  await page.click('button:has-text("Entre ou Cadastre-se")');
  await page.waitForTimeout(2000);

  // Take screenshot of popup
  await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'cofema_login_popup.png') });
  console.log('Saved screenshot of login popup');

  // Inspect popup content
  const popContent = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"], [role="popover"], div[class*="dialog"], div[class*="popover"], div[data-state="open"]');
    return dialog ? dialog.innerHTML : document.body.innerHTML;
  });

  console.log('Popup HTML snippet:', popContent.substring(0, 1000));

  await browser.close();
}

main().catch(console.error);
