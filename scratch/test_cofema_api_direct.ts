import { chromium } from 'playwright';

async function testCofemaApiDirect() {
  console.log('Starting Cofema direct API test...');

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

  const interceptedCalls: any[] = [];

  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/') || req.method() === 'POST' || url.includes('_rsc')) {
      interceptedCalls.push({
        method: req.method(),
        url,
        postData: req.postData()
      });
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/produto') || (url.includes('/api/') && res.request().method() === 'POST')) {
      try {
        const json = await res.json();
        console.log(`\n[API RESPONSE MATCH] ${url}`);
        console.log(JSON.stringify(json).substring(0, 500));
      } catch (e) {
        try {
          const text = await res.text();
          console.log(`\n[API RESPONSE TEXT] ${url}: ${text.substring(0, 300)}`);
        } catch (err) {}
      }
    }
  });

  console.log('Navigating to homepage first...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Navigating to Categoria 01 (Ferragens / Utilidades Domésticas)...');
  await page.goto('https://www.cofema.com.br/page/categoria/01', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('Scrolling down to trigger fetch/XHR calls...');
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(2000);
  }

  console.log('\n--- INTERCEPTED APIS ---');
  console.log(JSON.stringify(interceptedCalls, null, 2));

  // Now test direct fetch inside page context to /api/produto or relative endpoint!
  console.log('\n--- TESTING DIRECT IN-BROWSER FETCH TO /api/produto ---');

  const directFetchTest = await page.evaluate(async () => {
    const results: any = {};

    // Test 1: fetchProdutos with CATEGORIA filter
    try {
      const res1 = await fetch('/api/produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetchProdutos',
          params: {
            page: 1,
            limit: 50,
            filters: { CATEGORIA: '01', FILIAL: '0101' }
          }
        })
      });
      results.test1 = { status: res1.status, body: await res1.json().catch(() => res1.text()) };
    } catch (e: any) {
      results.test1 = { error: e.message };
    }

    // Test 2: fetchProdutos with page/categoria/01 or page = 2
    try {
      const res2 = await fetch('/api/produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetchProdutos',
          params: {
            page: 2,
            limit: 50,
            filters: { FILIAL: '0101' }
          }
        })
      });
      results.test2 = { status: res2.status, body: await res2.json().catch(() => res2.text()) };
    } catch (e: any) {
      results.test2 = { error: e.message };
    }

    // Test 3: check window.__NEXT_DATA__ or React state or NEXT RSC payload
    results.nextData = (window as any).__NEXT_DATA__ || 'no __NEXT_DATA__';

    return results;
  });

  console.log('\n--- DIRECT FETCH RESULTS ---');
  console.log(JSON.stringify(directFetchTest, null, 2).substring(0, 2000));

  await browser.close();
}

testCofemaApiDirect().catch(err => {
  console.error(err);
  process.exit(1);
});
