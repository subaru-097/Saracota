const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const terms = [
    'CABO FLEX 100M COBRECOM 2,50MM',
    'DUCHA LORENZETTI BELLA DUCHA 127V',
    'CARRINHO DE MÃO ESFERA EXTRA FORTE 60 LTS',
    'DUCHA LORENZETTI TOP JET MULTI 127V'
  ];

  for (const t of terms) {
    const url = `https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(t)}`;
    await page.goto(url, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    const title = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/produto/"]'));
      for (const a of links) {
        const txt = a.innerText.trim();
        if (txt && !txt.startsWith('#') && !txt.includes('EMB:')) {
          return txt;
        }
      }
      return 'NÃO ENCONTRADO';
    });

    console.log(`Term: "${t}" ===> Title: "${title}"`);
  }

  await browser.close();
})();
