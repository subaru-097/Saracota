import { chromium } from 'playwright';

async function testFetchLoop() {
  console.log('Starting fast test fetch loop...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Directly fetch search API with no filters
  const resAll = await page.evaluate(async () => {
    try {
      const r = await fetch('https://api.cicalfer.com.br/v1/busca?pagina=1');
      return await r.json();
    } catch (e: any) {
      return { error: e.message };
    }
  });

  console.log('Search API Root (no dimensao filter):');
  console.log('Paginator:', resAll.paginator);
  console.log('Itens returned on page 1:', resAll.itens ? resAll.itens.length : 0);

  // Now test 5 dimensao IDs
  const sampleDimIds = ['00000007', '00000008', '00000009', '00000010', '00000011'];
  for (const dimId of sampleDimIds) {
    const res = await page.evaluate(async (id) => {
      try {
        const r = await fetch(`https://api.cicalfer.com.br/v1/busca?dimensao=${id}&pagina=1`);
        return await r.json();
      } catch (e: any) {
        return { error: e.message };
      }
    }, dimId);

    console.log(`Dimensao ${dimId}: total=${res?.paginator?.total}, itens=${res?.itens?.length}`);
  }

  await browser.close();
}

testFetchLoop().catch(console.error);
