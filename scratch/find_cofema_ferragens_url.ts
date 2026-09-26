import { chromium } from 'playwright';

async function checkCofemaLinks() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const categoryLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/categoria/"], a[href*="/page/"]'));
    return links.map(a => ({
      text: a.textContent?.trim() || '',
      href: (a as HTMLAnchorElement).href,
      ariaLabel: a.getAttribute('aria-label') || ''
    }));
  });

  console.log('Category Links found on Homepage:', JSON.stringify(categoryLinks, null, 2));

  // Check categories by fetching headers for 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15
  for (let i = 1; i <= 15; i++) {
    const code = String(i).padStart(2, '0');
    const url = `https://www.cofema.com.br/page/categoria/${code}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const meta = await page.evaluate(() => {
      const hText = document.querySelector('h1, h2, h3, .text-foreground')?.textContent?.trim() || '';
      const text = document.body ? document.body.innerText : '';
      const match = text.match(/(\d+)\s*produtos\s*encontrados/i);
      return { hText: hText.substring(0, 100), match: match ? match[0] : 'NONE' };
    });
    console.log(`Code ${code} (${url}) => HText: "${meta.hText}" | Match: "${meta.match}"`);
  }

  await browser.close();
}

checkCofemaLinks().catch(console.error);
