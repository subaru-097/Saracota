import { chromium } from 'playwright';

async function testCofemaCodes() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
  });

  const page = await context.newPage();
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  for (let i = 1; i <= 15; i++) {
    const code = String(i).padStart(2, '0');
    const targetUrl = `https://www.cofema.com.br/page/categoria/${code}`;

    await page.evaluate((url) => { window.location.href = url; }, targetUrl);
    await page.waitForTimeout(4000);

    const meta = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const match = text.match(/(\d+)\s*produtos\s*encontrados/i);
      const title = document.querySelector('h1, h2, h3.text-2xl, h3, div.text-foreground')?.textContent?.trim() || '';
      return { title: title.replace(/\s+/g, ' ').substring(0, 80), match: match ? match[0] : 'NONE' };
    });

    console.log(`Code ${code} => Title: "${meta.title}" | Count: ${meta.match}`);
  }

  await context.close();
  await browser.close();
}

testCofemaCodes().catch(console.error);
