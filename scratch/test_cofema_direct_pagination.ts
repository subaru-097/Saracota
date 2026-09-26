import { chromium } from 'playwright';

async function testRecordStructure() {
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
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(async () => {
    const r = await fetch('/api/produto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'fetchProdutosByCategoria',
        categoriaCodigo: '01',
        params: {
          sortBy: 'PERC_PROMOCAO',
          descending: true,
          filters: { TIPO_GRUPO_CODIGO: '01', FILIAL: '0101' },
          limit: 2,
          page: 1
        }
      })
    });
    return await r.json();
  });

  console.log('Sample Record 0:');
  console.log(JSON.stringify(res.records[0], null, 2));

  await browser.close();
}

testRecordStructure().catch(console.error);
