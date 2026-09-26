import { chromium } from 'playwright';

async function testCofemaScroll() {
  console.log('Testing Cofema infinite scroll behavior...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Intercept network requests to see API calls made during scroll
  let apiCallCount = 0;
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('/products') || url.includes('/categoria') || response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
      if (!url.includes('.png') && !url.includes('.jpg') && !url.includes('.css') && !url.includes('.js') && !url.includes('.svg') && !url.includes('google')) {
        apiCallCount++;
        // console.log(`[NET ${response.status()}] ${url.substring(0, 100)}`);
      }
    }
  });

  await page.goto('https://www.cofema.com.br/page/categoria/04', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  // Check total header
  const headerInfo = await page.evaluate(() => {
    const h3Text = document.querySelector('h3')?.textContent || '';
    const pText = Array.from(document.querySelectorAll('p')).map(p => p.textContent).join(' ');
    const bodyText = document.body.innerText;
    const match = bodyText.match(/(\d+)\s*produtos\s*encontrados/i);
    return { h3Text, match: match ? match[1] : null };
  });
  console.log('Header Info:', headerInfo);

  // Test 20 scroll rounds with smooth wheel scrolling vs scrollTo
  for (let i = 1; i <= 15; i++) {
    const beforeCount = await page.evaluate(() => document.querySelectorAll('a[aria-label^="Ver produto"]').length);
    
    // Smooth scroll down by mouse wheel or window.scrollBy
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(1200);

    const afterCount = await page.evaluate(() => document.querySelectorAll('a[aria-label^="Ver produto"]').length);
    console.log(`Scroll round ${i}: Before=${beforeCount}, After=${afterCount}, Diff=+${afterCount - beforeCount}`);
  }

  // Check if there is a loading spinner, "Carregar mais" button, or pagination at the bottom
  const bottomElements = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
    const spinners = document.querySelectorAll('.spinner, .loading, [aria-label*="carregando"]').length;
    return { buttons, spinners, scrollHeight: document.body.scrollHeight, scrollTop: window.scrollY };
  });
  console.log('Bottom elements:', bottomElements);

  await browser.close();
}

testCofemaScroll().catch(console.error);
