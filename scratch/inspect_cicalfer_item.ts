import { chromium } from 'playwright';

async function inspectCicalferItemStructure() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://cicalfer.com.br/produtos');
  await page.waitForTimeout(2000);

  const res = await page.evaluate(async () => {
    const r = await fetch('https://api.cicalfer.com.br/v1/busca?dimensao=00000007&pagina=1');
    return await r.json();
  });

  console.log('API Response keys:', Object.keys(res));
  if (res.itens && res.itens.length > 0) {
    console.log('Sample item 0:', JSON.stringify(res.itens[0], null, 2));
    console.log('Sample item 1:', JSON.stringify(res.itens[1], null, 2));
  } else {
    console.log('No itens array or empty:', res);
  }

  await browser.close();
}

inspectCicalferItemStructure().catch(console.error);
