import { chromium } from 'playwright';

async function testConstrujaPagination() {
  console.log('Testing Construjá pagination and product card fields extraction...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  }).catch(() => chromium.launch({ headless: true }));

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  // Accept LGPD cookie if visible
  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Find react-select container for items per page
  console.log('Looking for items per page select dropdown...');
  const selectControl = page.locator('.react-select__control, #react-select-2-input').first();
  if (await selectControl.isVisible().catch(() => false)) {
    console.log('Clicking react-select dropdown...');
    await selectControl.click();
    await page.waitForTimeout(600);

    // Look for option containing "96"
    const option96 = page.locator('.react-select__option:has-text("96"), [id*="react-select"]:has-text("96")').first();
    if (await option96.isVisible().catch(() => false)) {
      console.log('Selecting 96 items per page option...');
      await option96.click();
      await page.waitForTimeout(3000);
    } else {
      console.log('96 option not visible directly, typing 96...');
      await page.keyboard.type('96');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }
  }

  const cardsCount = await page.evaluate(() => document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]').length);
  console.log(`Cards count after 96 pagination select: ${cardsCount}`);

  // Extract detailed card fields
  const cardData = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]'));
    return containers.slice(0, 5).map(c => {
      const link = c.querySelector('a[href*="/produto/"]');
      const titleEl = c.querySelector('[class*="CardProduto_tituloCardProduto"]');
      const href = link?.getAttribute('href') || '';
      const match = href.match(/\/produto\/(\d+)/);
      const id = match ? match[1] : '';
      const rawTitle = titleEl?.textContent?.trim() || '';
      
      // Brand: first word before " - " or first token
      const brandMatch = rawTitle.match(/^([^-]+)\s*-\s*/);
      const brand = brandMatch ? brandMatch[1].trim() : rawTitle.split(' ')[0];

      // Price extraction
      const priceWhole = c.querySelector('[class*="valorUnitarioDestaque"], [class*="valorUnitario"], span.fw-bold')?.textContent?.trim() || '';
      const fullText = c.textContent || '';
      
      // Badges & Stock
      const embBadge = Array.from(c.querySelectorAll('.badge, [class*="Badge"], span')).map(s => s.textContent?.trim()).filter(t => t && (t.includes('EMB:') || t.includes('CX:') || t.includes('estoque') || t.includes('Emb.')));

      return {
        id,
        sku: `CON-${id}`,
        rawTitle,
        brand,
        priceWhole,
        href: href.startsWith('http') ? href : `https://www.construja.com.br${href}`,
        badges: embBadge.slice(0, 3)
      };
    });
  });

  console.log('Extracted Sample Products:', JSON.stringify(cardData, null, 2));

  // Check pagination pages info
  const paginationInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('ul.pagination li, .pagination button, [class*="pagination"] *'));
    const texts = buttons.map(b => b.textContent?.trim()).filter(Boolean);
    const bodyText = document.body.innerText;
    const match = bodyText.match(/(\d+)\s*produtos\s*encontrados/i) || bodyText.match(/Exibindo\s*\d+-(\d+)\s*de\s*(\d+)/i) || bodyText.match(/de\s*(\d+)\s*produtos/i);
    return {
      texts: texts.slice(0, 15),
      headerMatch: match ? match[0] : 'NONE',
      totalProducts: match ? match[match.length - 1] : null
    };
  });
  console.log('Pagination Info:', paginationInfo);

  await browser.close();
}

testConstrujaPagination().catch(console.error);
