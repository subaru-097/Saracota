import { chromium } from 'playwright';

async function main() {
  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
  } catch (e) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  page.on('request', req => {
    if (req.url().includes('/api/produto')) {
      console.log('\n========================================');
      console.log('REQUEST TO /api/produto');
      console.log('Method:', req.method());
      console.log('URL:', req.url());
      console.log('Headers:', JSON.stringify(req.headers(), null, 2));
      console.log('Payload:', req.postData());
      console.log('========================================\n');
    }
  });

  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.goto('https://www.cofema.com.br/page/categoria/01', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  await browser.close();
}

main().catch(console.error);
