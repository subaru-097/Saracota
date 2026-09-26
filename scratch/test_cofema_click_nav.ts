import { chromium } from 'playwright';

async function testClickNav() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await context.newPage();

  console.log('1. Loading homepage...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(4000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Find all category links/buttons on page
  const categoryLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a, button'));
    return anchors.map(a => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href') || '',
      ariaLabel: a.getAttribute('aria-label') || ''
    })).filter(x => x.text && (x.href.includes('/categoria/') || x.href.includes('/promocoes') || x.text.includes('Hidráulica') || x.text.includes('Elétrica') || x.text.includes('Ferragens')));
  });

  console.log('Category navigation items found:', JSON.stringify(categoryLinks, null, 2));

  // Let's click on "Hidráulica" or "Elétrica" link if found, or evaluate location href inside page!
  const hidraulicaLink = page.locator('a[href*="/categoria/03"], a:has-text("Hidráulica")').first();
  if (await hidraulicaLink.isVisible().catch(() => false)) {
    console.log('Clicking Hidráulica link...');
    await hidraulicaLink.click();
    await page.waitForTimeout(5000);
  } else {
    console.log('Using in-page pushState / client navigation for Hidráulica...');
    await page.evaluate(() => {
      // simulate clicking link or window.location
      const a = Array.from(document.querySelectorAll('a')).find(el => el.href.includes('/categoria/03') || el.textContent?.includes('Hidráulica'));
      if (a) a.click();
      else window.location.href = '/page/categoria/03';
    });
    await page.waitForTimeout(5000);
  }

  console.log('Current URL after navigation:', page.url());

  const meta = await page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const match = text.match(/(\d+)\s*produtos\s*encontrados/i) || text.match(/(\d+)\s*produtos/i);
    const title = document.querySelector('h1, h2, h3.text-2xl, h3')?.textContent?.trim() || '';
    return {
      title,
      headerTextMatch: match ? match[0] : null,
      totalEsperado: match ? parseInt(match[1], 10) : 0
    };
  });
  console.log('Meta on page:', meta);

  const cardsCount = await page.evaluate(() => document.querySelectorAll('a[aria-label^="Ver produto"]').length);
  console.log('Cards count:', cardsCount);

  await browser.close();
}

testClickNav().catch(console.error);
