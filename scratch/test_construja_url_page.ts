import { chromium } from 'playwright';

async function testConstrujaUrlPage() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await context.newPage();

  // Test url patterns for page 2 and page 3
  const testUrls = [
    'https://www.construja.com.br/produtos?page=2',
    'https://www.construja.com.br/produtos?p=2',
    'https://www.construja.com.br/produtos?pagina=2',
    'https://www.construja.com.br/produtos?page=10'
  ];

  for (const url of testUrls) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const firstProductTitle = await page.evaluate(() => {
      const container = document.querySelector('div[class*="CardProduto_cardBodyContainer"]');
      const titleEl = container?.querySelector('[class*="CardProduto_tituloCardProduto"]');
      const href = container?.querySelector('a[href*="/produto/"]')?.getAttribute('href');
      const paginatorStr = document.body ? document.body.innerText.match(/Página\s+\d+|Mostrando\s+\d+|de\s+\d+\s+páginas/i)?.[0] : '';
      return {
        title: titleEl?.textContent?.trim() || 'NÃO_ENCONTRADO',
        href,
        paginatorStr
      };
    });

    console.log(`URL: ${url.padEnd(50, ' ')} | First Product: "${firstProductTitle.title}" | Paginator: "${firstProductTitle.paginatorStr}"`);
  }

  await context.close();
  await browser.close();
}

testConstrujaUrlPage().catch(console.error);
