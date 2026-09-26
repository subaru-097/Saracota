import { chromium } from 'playwright';

async function inspectCategoriesAndPagination() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  }).catch(() => chromium.launch({ headless: true }));

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Find all category items under "Todos Produtos" menu or sidebar
  const categories = await page.evaluate(() => {
    // Look for spans with class font-size-14 fw-medium text-uppercase
    const spans = Array.from(document.querySelectorAll('span.font-size-14.fw-medium.text-uppercase'));
    return spans.map(s => {
      // climb to ancestor button/a/div
      let parent = s.parentElement;
      while (parent && parent.tagName !== 'BUTTON' && parent.tagName !== 'A' && !parent.getAttribute('role')) {
        parent = parent.parentElement;
      }
      return {
        name: s.textContent?.trim() || '',
        tagName: parent?.tagName || s.parentElement?.tagName || '',
        id: parent?.id || s.id || ''
      };
    }).filter(x => x.name && x.name !== 'TODOS PRODUTOS');
  });

  console.log(`Found ${categories.length} subcategories/categories:`, JSON.stringify(categories.slice(0, 15), null, 2));

  // Inspect bottom pagination controls
  const paginationDetails = await page.evaluate(() => {
    const listItems = Array.from(document.querySelectorAll('ul.pagination li, .pagination a, [class*="pagination"] button, [class*="paginacao"] *'));
    const allButtons = Array.from(document.querySelectorAll('button, a')).filter(b => {
      const text = b.textContent?.trim() || '';
      return text.match(/^\d+$/) || text.includes('Próxim') || text.includes('>') || text.includes('Anterior');
    });
    return {
      listItemsText: listItems.map(l => l.textContent?.trim()).filter(Boolean),
      buttonsText: allButtons.slice(0, 10).map(b => b.textContent?.trim())
    };
  });

  console.log('Pagination Controls:', paginationDetails);

  await browser.close();
}

inspectCategoriesAndPagination().catch(console.error);
