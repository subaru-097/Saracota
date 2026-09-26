import { chromium } from 'playwright';

async function testPaginationParams() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const testUrls = [
    'https://api.cicalfer.com.br/v1/busca?pagina=1',
    'https://api.cicalfer.com.br/v1/busca?pagina=2',
    'https://api.cicalfer.com.br/v1/busca?page=2',
    'https://api.cicalfer.com.br/v1/busca?p=2',
    'https://api.cicalfer.com.br/v1/busca?offset=20',
    'https://api.cicalfer.com.br/v1/busca?start=20',
    'https://api.cicalfer.com.br/v1/busca?limite=20&inicio=20',
  ];

  for (const u of testUrls) {
    const res = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url);
        const data = await r.json();
        const firstItemName = data?.itens?.[0]?.descComp || 'N/A';
        const firstItemId = data?.itens?.[0]?.idExibicao || data?.itens?.[0]?.id || 'N/A';
        return { url, pageFromPaginator: data?.paginator?.current_page, firstItemId, firstItemName };
      } catch (e: any) {
        return { url, error: e.message };
      }
    }, u);

    console.log(`URL: ${res.url}`);
    console.log(`  -> Current Page: ${res.pageFromPaginator}, First Item: [ID ${res.firstItemId}] ${res.firstItemName}`);
  }

  await browser.close();
}

testPaginationParams().catch(console.error);
