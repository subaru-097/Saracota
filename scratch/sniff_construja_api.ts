import { chromium } from 'playwright';
import * as fs from 'fs';

async function sniffConstrujaApi() {
  console.log('🔍 Iniciando inspeção de API no site Construjá (https://construja.com.br)...');

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
    locale: 'pt-BR'
  });

  const page = await context.newPage();

  const apiCalls: any[] = [];

  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/') || url.includes('graphql') || url.includes('json') || req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
      if (!url.includes('google') && !url.includes('facebook') && !url.includes('analytics') && !url.includes('sentry')) {
        apiCalls.push({
          method: req.method(),
          url,
          headers: req.headers(),
          postData: req.postData()
        });
        console.log(`[CONSTRUJÁ REQUEST] ${req.method()} ${url}`);
      }
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('graphql') || (res.request().resourceType() === 'fetch' && !url.includes('analytics'))) {
      try {
        const text = await res.text();
        console.log(`[CONSTRUJÁ RESPONSE ${res.status()}] ${url.substring(0, 100)}`);
        console.log(`Snippet: ${text.substring(0, 200)}`);
      } catch (e) {}
    }
  });

  console.log('Navegando para a página principal da Construjá...');
  await page.goto('https://construja.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log('Navegando para a primeira categoria...');
  // Find category link
  const firstCatUrl = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/categoria/"], a[href*="/produtos/"], a[href*="/busca"]');
    return link ? (link as HTMLAnchorElement).href : 'https://construja.com.br/busca';
  });

  console.log(`Target URL: ${firstCatUrl}`);
  await page.goto(firstCatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // Scroll and paginate
  console.log('Simulando interação para capturar chamadas de paginação/fetch...');
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(3000);

  fs.writeFileSync('scratch/construja_api_calls.json', JSON.stringify(apiCalls, null, 2));
  console.log(`\n✅ Capturadas ${apiCalls.length} chamadas de API da Construjá salvas em scratch/construja_api_calls.json`);

  await browser.close();
}

sniffConstrujaApi().catch(console.error);
