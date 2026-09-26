import { chromium } from 'playwright';

async function inspectCofemaEletrica() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('Navigating to Cofema Elétrica (/page/categoria/04)...');
  await page.goto('https://www.cofema.com.br/page/categoria/04', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(4000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Header inspection
  const headerInfo = await page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const match = text.match(/(\d+)\s*produtos\s*encontrados/i) || text.match(/(\d+)\s*produtos/i);
    const title = document.querySelector('h1, h2, h3.text-2xl, h3')?.textContent?.trim() || '';
    return {
      title,
      headerTextMatch: match ? match[0] : 'NONE',
      totalEsperado: match ? parseInt(match[1], 10) : 0
    };
  });
  console.log('Header Info:', headerInfo);

  // Check total cards right now
  let cards = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[aria-label^="Ver produto"]'));
    return links.map(a => {
      const ariaLabel = a.getAttribute('aria-label') || '';
      const href = a.getAttribute('href') || '';
      const name = ariaLabel.replace(/^Ver produto\s*/i, '').trim();
      const match = href.match(/\/produto\/(\d+)-/);
      const id = match ? match[1] : '';
      return { id, name, href };
    }).filter(x => x.id);
  });
  console.log(`Initial cards count: ${cards.length}`);

  // Test scrolling down multiple times and logging progress
  let uniqueIds = new Set(cards.map(c => c.id));
  console.log(`Initial unique IDs: ${uniqueIds.size}`);

  for (let i = 1; i <= 20; i++) {
    // Scroll down to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    const newCards = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[aria-label^="Ver produto"]'));
      return links.map(a => {
        const ariaLabel = a.getAttribute('aria-label') || '';
        const href = a.getAttribute('href') || '';
        const name = ariaLabel.replace(/^Ver produto\s*/i, '').trim();
        const match = href.match(/\/produto\/(\d+)-/);
        const id = match ? match[1] : '';
        return { id, name, href };
      }).filter(x => x.id);
    });

    const prevCount = cards.length;
    newCards.forEach(c => uniqueIds.add(c.id));
    cards = newCards;

    console.log(`[Scroll ${i}] DOM items count: ${cards.length} | Total Unique IDs in Set: ${uniqueIds.size} | Diff in DOM: +${cards.length - prevCount}`);
  }

  await browser.close();
}

inspectCofemaEletrica().catch(console.error);
