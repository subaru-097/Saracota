import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const requests: any[] = [];

  page.on('request', req => {
    requests.push({
      method: req.method(),
      url: req.url(),
      resourceType: req.resourceType(),
      headers: req.headers(),
      postData: req.postData()
    });
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('json') || url.includes('graphql') || url.includes('produto') || url.includes('categoria')) {
      try {
        const text = await res.text();
        console.log(`[RESPONSE MATCH] ${res.status()} ${url}`);
        console.log('Snippet:', text.substring(0, 300));
      } catch (e) {}
    }
  });

  console.log('Navigating...');
  await page.goto('https://www.cofema.com.br/page/categoria/01', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  console.log('Initial product count in DOM:', await page.locator('a[href*="/page/produto/"]').count());

  console.log('Scrolling down multiple times...');
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    const currentCount = await page.locator('a[href*="/page/produto/"]').count();
    console.log(`Scroll ${i+1}: DOM has ${currentCount} product links`);
  }

  fs.writeFileSync('scratch/cofema_requests.json', JSON.stringify(requests, null, 2));
  console.log(`Saved ${requests.length} requests to scratch/cofema_requests.json`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
