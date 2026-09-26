const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  console.log('Navigating to Cofema...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const headerInfo = await page.evaluate(() => {
    const clickable = Array.from(document.querySelectorAll('a, button, [role="button"], span, div')).map(el => ({
      tag: el.tagName,
      id: el.id,
      class: el.className,
      text: el.innerText ? el.innerText.trim().replace(/\s+/g, ' ') : '',
      href: el.href || el.getAttribute('href') || ''
    })).filter(x => x.text.length > 0 && x.text.length < 50);

    return clickable;
  });

  fs.writeFileSync('scratch/cofema_clickable.json', JSON.stringify(headerInfo, null, 2));
  console.log(`Saved ${headerInfo.length} clickable elements to scratch/cofema_clickable.json`);

  // Take a full page screenshot
  await page.screenshot({ path: 'scratch/cofema_homepage.png', fullPage: false });

  await browser.close();
})();
