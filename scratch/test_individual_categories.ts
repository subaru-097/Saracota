import { chromium } from 'playwright';

async function testFreshCategoryLoad() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  }).catch(() => chromium.launch({ headless: true }));

  const categories = [
    { name: 'Ferragens', url: 'https://www.cofema.com.br/page/categoria/02' },
    { name: 'Hidráulica', url: 'https://www.cofema.com.br/page/categoria/03' },
    { name: 'Elétrica', url: 'https://www.cofema.com.br/page/categoria/04' },
    { name: 'Pintura', url: 'https://www.cofema.com.br/page/categoria/05' },
    { name: 'Limpeza', url: 'https://www.cofema.com.br/page/categoria/08' },
    { name: 'Jardinagem', url: 'https://www.cofema.com.br/page/categoria/10' },
  ];

  for (const cat of categories) {
    console.log(`\nTesting fresh load for: ${cat.name} (${cat.url})...`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      locale: 'pt-BR',
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    // 1. Establish session at Home
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    // 2. Navigate to category page
    await page.evaluate((targetUrl) => {
      window.location.href = targetUrl;
    }, cat.url);

    await page.waitForTimeout(4000);

    const meta = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const match = text.match(/(\d+)\s*produtos\s*encontrados/i) || text.match(/(\d+)\s*produtos/i);
      const title = document.querySelector('h1, h2, h3.text-2xl, h3')?.textContent?.trim() || '';
      return {
        title,
        headerMatch: match ? match[0] : 'NONE',
        totalEsperado: match ? parseInt(match[1], 10) : 0
      };
    });

    const cardsCount = await page.evaluate(() => document.querySelectorAll('a[aria-label^="Ver produto"]').length);

    console.log(`Results for ${cat.name}:`);
    console.log(`  - Title: "${meta.title}"`);
    console.log(`  - Header Match: "${meta.headerMatch}"`);
    console.log(`  - Total Esperado: ${meta.totalEsperado}`);
    console.log(`  - Initial Cards in DOM: ${cardsCount}`);

    await context.close();
  }

  await browser.close();
}

testFreshCategoryLoad().catch(console.error);
