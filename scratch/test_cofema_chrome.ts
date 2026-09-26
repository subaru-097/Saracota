import { chromium } from 'playwright';

async function testCategoryNav() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1440,900'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  console.log('1. Loading Home Page...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForTimeout(3000);

  console.log('2. Navigating to /page/categoria/04 (Elétrica)...');
  await page.evaluate(() => {
    window.location.href = '/page/categoria/04';
  });
  await page.waitForTimeout(5000);

  console.log('URL:', page.url());

  const meta = await page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const match = text.match(/(\d+)\s*produtos\s*encontrados/i) || text.match(/(\d+)\s*produtos/i);
    const title = document.querySelector('h1, h2, h3.text-2xl, h3')?.textContent?.trim() || '';
    return {
      title,
      headerTextMatch: match ? match[0] : 'NONE',
      totalEsperado: match ? parseInt(match[1], 10) : 0
    };
  });
  console.log('Header Info:', meta);

  const domCards = await page.evaluate(() => document.querySelectorAll('a[aria-label^="Ver produto"]').length);
  console.log('Initial DOM Cards on Elétrica page:', domCards);

  await browser.close();
}

testCategoryNav().catch(console.error);
