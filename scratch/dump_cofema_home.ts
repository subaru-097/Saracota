import { chromium } from 'playwright';

async function dumpCofemaHome() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log('Navigating to homepage...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(6000);

  const title = await page.title();
  console.log('Page Title:', title);

  const html = await page.content();
  console.log('HTML Length:', html.length);

  // Extract all text content
  const text = await page.evaluate(() => document.body.innerText.substring(0, 1500));
  console.log('Page Text Snapshot:\n', text);

  // Extract all hrefs
  const hrefs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({ text: a.textContent?.trim(), href: a.getAttribute('href') }));
  });
  console.log('All links found:', JSON.stringify(hrefs.slice(0, 30), null, 2));

  await browser.close();
}

dumpCofemaHome().catch(console.error);
