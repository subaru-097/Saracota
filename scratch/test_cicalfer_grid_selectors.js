const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=CABO%20FLEX%20100M%20COBRECOM%202%2C50MM', { waitUntil: 'networkidle' });
  
  const debugInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.card, div[class*="Produto"], div[class*="card"]'));
    return cards.slice(0, 3).map((c, i) => {
      const links = Array.from(c.querySelectorAll('a[href^="/produto/"]')).map(a => a.innerText.trim());
      const h5s = Array.from(c.querySelectorAll('h5')).map(h => h.innerText.trim());
      const titles = Array.from(c.querySelectorAll('[class*="title"], [class*="Title"]')).map(t => t.innerText.trim());
      return {
        cardIndex: i,
        rawText: c.innerText.replace(/\n+/g, ' | '),
        links,
        h5s,
        titles
      };
    });
  });

  console.log(JSON.stringify(debugInfo, null, 2));
  await browser.close();
})();
