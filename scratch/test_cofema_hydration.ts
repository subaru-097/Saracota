import { chromium } from 'playwright';

async function testHydration() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Listen to console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });
  page.on('pageerror', err => console.log('PAGE UNCAUGHT ERROR:', err.message));

  console.log('1. Navigating to homepage...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'networkidle', timeout: 35000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const titleHome = await page.title();
  console.log('Home title:', titleHome);

  console.log('2. Navigating to /page/categoria/04 via client router or page.goto...');
  // Let's try client-side router navigation or clicking menu
  await page.evaluate(() => {
    window.location.href = 'https://www.cofema.com.br/page/categoria/04';
  });
  await page.waitForTimeout(5000);

  const headerInfo = await page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const match = text.match(/(\d+)\s*produtos\s*encontrados/i) || text.match(/(\d+)\s*produtos/i);
    const h3Text = document.querySelector('h1, h2, h3')?.textContent?.trim() || '';
    return { h3Text, match: match ? match[0] : null, totalEsperado: match ? parseInt(match[1], 10) : 0 };
  });
  console.log('Header Info:', headerInfo);

  const cardsCount = await page.evaluate(() => document.querySelectorAll('a[aria-label^="Ver produto"]').length);
  console.log('Cards count on Elétrica page:', cardsCount);

  await browser.close();
}

testHydration().catch(console.error);
