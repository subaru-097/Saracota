import { chromium } from 'playwright';

async function inspectConstrujaStructure() {
  console.log('Inspecting Construjá website structure...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  }).catch(() => chromium.launch({ headless: true }));

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  console.log('1. Navigating to https://www.construja.com.br/produtos...');
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(4000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const title = await page.title();
  console.log('Page Title:', title);

  // Check category menu items
  const menuItems = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span.font-size-14.fw-medium.text-uppercase, a[href*="categoria"], button'));
    return spans.map(s => ({
      text: s.textContent?.trim(),
      tag: s.tagName,
      parentTag: s.parentElement?.tagName,
      href: (s as any).href || s.getAttribute('href') || s.parentElement?.getAttribute('href')
    })).filter(x => x.text && x.text.length < 50);
  });
  console.log('Menu items sample:', JSON.stringify(menuItems.slice(0, 20), null, 2));

  // Check react-select pagination element
  const reactSelects = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[id*="react-select"]'));
    return inputs.map(i => ({ id: i.id, placeholder: (i as any).placeholder, value: (i as any).value }));
  });
  console.log('React Select inputs found:', reactSelects);

  // Check CardProduto elements currently in DOM
  const cards = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]'));
    return containers.map(c => {
      const link = c.querySelector('a[href*="/produto/"]');
      const titleEl = c.querySelector('[class*="CardProduto_tituloCardProduto"]');
      const href = link?.getAttribute('href') || '';
      const idMatch = href.match(/\/produto\/(\d+)-/);
      const precoDestaque = c.querySelector('[class*="valorUnitarioDestaque"]')?.textContent?.trim() || '';
      return {
        id: idMatch ? idMatch[1] : '',
        title: titleEl?.textContent?.trim() || '',
        href,
        precoDestaque
      };
    });
  });
  console.log(`Cards count in DOM: ${cards.length}`);
  if (cards.length > 0) {
    console.log('Sample Card:', cards[0]);
  }

  await browser.close();
}

inspectConstrujaStructure().catch(console.error);
