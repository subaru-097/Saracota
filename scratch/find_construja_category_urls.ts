import { chromium } from 'playwright';

async function findConstrujaUrls() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const categoryAnchors = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    return anchors.map(a => ({
      text: a.textContent?.trim() || '',
      href: (a as HTMLAnchorElement).href,
      class: a.className
    })).filter(a => a.href.includes('/categoria') || a.href.includes('/produtos') || a.href.includes('/departamento') || a.text.length > 0);
  });

  console.log('Category Anchors found:', JSON.stringify(categoryAnchors.slice(0, 50), null, 2));
  await browser.close();
}

findConstrujaUrls().catch(console.error);
