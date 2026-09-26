import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Listening to network requests and responses...');

  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/') || url.includes('fetch') || req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
      console.log(`\n[REQUEST] ${req.method()} ${url}`);
      console.log('Headers:', req.headers());
      const postData = req.postData();
      if (postData) {
        console.log('Post Data:', postData);
      }
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/') || res.request().resourceType() === 'fetch' || res.request().resourceType() === 'xhr') {
      console.log(`\n[RESPONSE ${res.status()}] ${url}`);
      try {
        const text = await res.text();
        console.log('Body snippet:', text.substring(0, 500));
      } catch (e) {
        console.log('Could not read body');
      }
    }
  });

  console.log('Navigating to https://www.cofema.com.br/page/categoria/01 ...');
  await page.goto('https://www.cofema.com.br/page/categoria/01', { waitUntil: 'networkidle', timeout: 60000 });

  console.log('Scrolling down...');
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 1500));
    await page.waitForTimeout(3000);
  }

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
