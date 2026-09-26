import { chromium } from 'playwright';

async function testDimensaoPage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Test dimension ID for subcategory
  const testSubcats = [
    { dimId: '00000007', catPai: 'ELETRICA', subcat: 'ABRACADEIRAS' },
    { dimId: '00000014', catPai: 'ELETRICA', subcat: 'ADAPTADORES' },
    { dimId: '00000643', catPai: 'HIDRAULICA', subcat: 'CAIXAS D AGUA' },
  ];

  for (const s of testSubcats) {
    const res = await page.evaluate(async (dim) => {
      try {
        const r = await fetch(`https://api.cicalfer.com.br/v1/busca?dimensao=${dim}&page=1`);
        return await r.json();
      } catch (e: any) {
        return { error: e.message };
      }
    }, s.dimId);

    console.log(`Dimensao ${s.dimId} (${s.catPai} > ${s.subcat}):`);
    console.log(`  -> Paginator: total=${res?.paginator?.total}, last_page=${res?.paginator?.last_page}`);
    console.log(`  -> Itens returned on page 1: ${res?.itens?.length}`);
    if (res?.itens?.length > 0) {
      console.log(`  -> Sample item 0: [ID ${res.itens[0].idExibicao || res.itens[0].id}] ${res.itens[0].descComp}`);
    }
  }

  await browser.close();
}

testDimensaoPage().catch(console.error);
