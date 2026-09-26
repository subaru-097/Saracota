import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

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

  // Print all links and buttons with "Entre", "Cadastre", "Login", "Cliente"
  const linksAndBtns = await page.evaluate(() => {
    const els = document.querySelectorAll('a, button, div, span');
    const matches: any[] = [];
    els.forEach(el => {
      const txt = (el as HTMLElement).innerText || '';
      if (txt.includes('Entre') || txt.includes('Login') || txt.includes('Cliente') || txt.includes('Cadastre')) {
        matches.push({
          tag: el.tagName,
          text: txt.substring(0, 50),
          id: el.id,
          class: el.className,
          href: (el as HTMLAnchorElement).href || null,
        });
      }
    });
    return matches;
  });

  console.log('Found matching login elements:', JSON.stringify(linksAndBtns, null, 2));

  await browser.close();
}

main().catch(console.error);
