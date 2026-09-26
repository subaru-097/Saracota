import { chromium } from 'playwright';

async function inspectCicalferSubcategoryNetwork() {
  console.log('🔍 Interceptando requisições de rede ao clicar em subcategoria...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('request', (req) => {
    if (req.url().includes('/v1/busca') || req.url().includes('api.cicalfer')) {
      console.log(`🌐 REQUEST URL: ${req.url()}`);
      console.log(`   METHOD: ${req.method()}`);
      if (req.postData()) {
        console.log(`   POST DATA: ${req.postData()}`);
      }
    }
  });

  page.on('response', async (res) => {
    if (res.url().includes('/v1/busca') || res.url().includes('api.cicalfer')) {
      try {
        const body = await res.json();
        console.log(`📥 RESPONSE URL: ${res.url()}`);
        console.log(`   Paginator: ${JSON.stringify(body?.paginator)}`);
        console.log(`   Items count: ${body?.itens?.length}`);
        if (body?.itens?.length > 0) {
          console.log(`   Sample item 0: [ID ${body.itens[0].idExibicao || body.itens[0].id}] ${body.itens[0].descComp}`);
        }
      } catch (e) {}
    }
  });

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click MuiAccordionSummary to expand Eletrica
  console.log('Expanding accordion...');
  await page.evaluate(() => {
    const summaries = Array.from(document.querySelectorAll('.MuiAccordionSummary-root'));
    summaries.forEach((s) => (s as HTMLElement).click());
  });
  await page.waitForTimeout(2000);

  // Find subcategory links or divs
  console.log('Clicking on a subcategory accordion or button...');
  const clicked = await page.evaluate(() => {
    const subDivs = Array.from(document.querySelectorAll('div[id^="dimensao-"]'));
    if (subDivs.length > 0) {
      const firstSub = subDivs[0];
      const target = firstSub.querySelector('span, a, div') || firstSub;
      (target as HTMLElement).click();
      return firstSub.id;
    }
    return null;
  });

  console.log(`Clicked element ID: ${clicked}`);
  await page.waitForTimeout(4000);

  await browser.close();
}

inspectCicalferSubcategoryNetwork().catch(console.error);
