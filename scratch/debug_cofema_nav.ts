import { chromium } from 'playwright';

async function debugCofemaPages() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log('Navigating to homepage...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Check categories on home page
  const categoryLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href'),
      ariaLabel: a.getAttribute('aria-label')
    })).filter(x => x.href && (x.href.includes('categoria') || x.href.includes('page') || x.href.includes('promocoes')));
  });
  console.log('Category links found on homepage:', JSON.stringify(categoryLinks, null, 2));

  // Let's click on Elétrica link or button on home
  const eletricaBtn = page.locator('a[href*="04"], button:has-text("Elétrica"), a:has-text("Elétrica")').first();
  if (await eletricaBtn.isVisible().catch(() => false)) {
    console.log('Found Elétrica button/link, clicking it...');
    await eletricaBtn.click();
    await page.waitForTimeout(5000);
    console.log('Current URL after click:', page.url());

    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Page text snapshot:', pageText);

    const cardsCount = await page.evaluate(() => document.querySelectorAll('a[aria-label^="Ver produto"]').length);
    console.log('Cards count on Elétrica page:', cardsCount);
  } else {
    console.log('Elétrica button not visible directly');
  }

  await browser.close();
}

debugCofemaPages().catch(console.error);
