import { chromium } from 'playwright';

async function testCF() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
    }
  });

  const page = await context.newPage();

  console.log('Navigating to homepage...');
  const resHome = await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
  console.log('Homepage status:', resHome?.status());
  await page.waitForTimeout(3000);

  console.log('Navigating to Elétrica (/page/categoria/04)...');
  const resEl = await page.goto('https://www.cofema.com.br/page/categoria/04', { waitUntil: 'domcontentloaded', timeout: 35000 });
  console.log('Elétrica status:', resEl?.status());
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('Body snippet:', bodyText.replace(/\n+/g, ' '));

  const cardsCount = await page.evaluate(() => document.querySelectorAll('a[aria-label^="Ver produto"]').length);
  console.log('Cards count:', cardsCount);

  await browser.close();
}

testCF().catch(console.error);
