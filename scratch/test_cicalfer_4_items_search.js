const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const items = [
    'CAIXA DE ÁGUA FECHADA FORTLEV 310 LITROS',
    'DUCHA LORENZETTI MAXI DUCHA 127V',
    'BIANCO 900G',
    'ALICATE BOMBA D\'ÁGUA MTX 10'
  ];

  const term = 'CAIXA D AGUA FECHADA FORTLEV 310L';
  await page.goto(`https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(term)}`, { waitUntil: 'networkidle' });
  const results = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/produto/"]'));
    return links.map(a => a.innerText.trim()).filter(t => t && !t.startsWith('#') && !t.includes('EMB:'));
  });
  console.log(`Busca: "${term}" => ${results.length} resultados.`);
  if (results.length > 0) console.log('Top:', results.slice(0, 3));



  await browser.close();
})();
