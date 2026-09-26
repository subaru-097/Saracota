import { chromium } from 'playwright';

async function sniffCofemaApi() {
  console.log('================================================================================');
  console.log('🕵️ NETWORK SNIFFER: INTERCEPTANDO REQUISIÇÕES FETCH/XHR DA COFEMA (FERRAGENS)');
  console.log('================================================================================\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
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

  const capturedRequests: { url: string; method: string; headers: Record<string, string>; postData: string | null }[] = [];

  // Listen to all network requests
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    const url = req.url();
    if (resourceType === 'fetch' || resourceType === 'xhr' || url.includes('/api/') || url.includes('_next/data') || url.includes('graphql') || url.includes('produtos')) {
      if (!url.includes('.png') && !url.includes('.jpg') && !url.includes('.svg') && !url.includes('google-analytics') && !url.includes('gtm')) {
        capturedRequests.push({
          url,
          method: req.method(),
          headers: req.headers(),
          postData: req.postData()
        });
        console.log(`🌐 [${req.method()}] [${resourceType}] ${url}`);
        if (req.postData()) {
          console.log(`   Payload: ${req.postData()?.substring(0, 300)}`);
        }
      }
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('_next/data') || url.includes('produtos') || url.includes('categoria')) {
      try {
        const text = await res.text();
        console.log(`📥 [Response] status ${res.status()} from ${url.substring(0, 80)}`);
        console.log(`   Sample Body: ${text.substring(0, 250)}\n`);
      } catch (e) {}
    }
  });

  console.log('1️⃣ Acessando homepage...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  console.log('2️⃣ Navegando para Ferragens (/page/categoria/01)...');
  await page.evaluate(() => {
    window.location.href = 'https://www.cofema.com.br/page/categoria/01';
  });
  await page.waitForTimeout(4000);

  console.log('3️⃣ Executando scroll lento para disparar requisições de API...');
  for (let i = 1; i <= 5; i++) {
    console.log(`   ---> Scroll #${i}`);
    await page.evaluate(() => { window.scrollBy(0, 1500); });
    await page.waitForTimeout(2500);
  }

  console.log('\n================================================================================');
  console.log(`📌 REQUISIÇÕES FETCH/XHR CAPTURADAS (${capturedRequests.length} no total):`);
  console.log('================================================================================');
  capturedRequests.forEach((r, idx) => {
    console.log(`\n--- REQ #${idx + 1} ---`);
    console.log(`Method: ${r.method}`);
    console.log(`URL: ${r.url}`);
    console.log(`Headers:`, JSON.stringify(r.headers, null, 2));
    if (r.postData) console.log(`Payload:`, r.postData);
  });

  await context.close();
  await browser.close();
}

sniffCofemaApi().catch(console.error);
