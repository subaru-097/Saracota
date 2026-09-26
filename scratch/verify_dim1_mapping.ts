import { chromium } from 'playwright';

const CATEGORIAS_PAI_MAP: Record<string, string> = {
  '00001003': 'ELETRICA',
  '00001005': 'HIDRAULICA',
  '00001006': 'PINTURA',
  '00001008': 'FERRAMENTAS',
  '00001004': 'FERRAGENS',
};

async function testDim1Mapping() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Fetch subcategories map from DOM
  await page.evaluate(() => {
    const summaries = Array.from(document.querySelectorAll('.MuiAccordionSummary-root'));
    summaries.forEach((s) => (s as HTMLElement).click());
  });
  await page.waitForTimeout(2000);

  const subNameMap: Record<string, string> = await page.evaluate(() => {
    const subDivs = Array.from(document.querySelectorAll('div[id^="dimensao-"]'));
    const map: Record<string, string> = {};
    subDivs.forEach((div) => {
      const fullId = div.id.replace('dimensao-', '').trim();
      const span = div.querySelector('span');
      if (span && fullId) {
        map[fullId] = (span.textContent || '').trim();
      }
    });
    return map;
  });

  console.log(`Subcategories in DOM map: ${Object.keys(subNameMap).length}`);

  const countsPai: Record<string, number> = {};
  let totalWithSub = 0;
  let totalWithoutSub = 0;

  for (let p = 1; p <= 96; p++) {
    const res = await page.evaluate(async (pagNum) => {
      const r = await fetch(`https://api.cicalfer.com.br/v1/busca?page=${pagNum}`);
      return await r.json();
    }, p);

    if (res && res.itens) {
      res.itens.forEach((it: any) => {
        const catPaiCode = it.dim1 || 'DESCONHECIDO';
        const catPaiNome = CATEGORIAS_PAI_MAP[catPaiCode] || `OUTROS (${catPaiCode})`;

        countsPai[catPaiNome] = (countsPai[catPaiNome] || 0) + 1;

        const subCode = it.dim2; // e.g. "00000007-00001003"
        const subNome = subNameMap[subCode] || it.baseLinhaNome || it.categoriaNome || 'GERAL';

        if (subNome !== 'GERAL') {
          totalWithSub++;
        } else {
          totalWithoutSub++;
        }
      });
    }
  }

  console.log('\n📊 DISTRIBUIÇÃO DAS CATEGORIAS PAI (1.901 SKUS):');
  console.log(JSON.stringify(countsPai, null, 2));
  console.log(`\n• Com subcategoria identificada: ${totalWithSub}`);
  console.log(`• Sem subcategoria (apenas Categoria Pai): ${totalWithoutSub}`);

  await browser.close();
}

testDim1Mapping().catch(console.error);
