import { chromium } from 'playwright';

async function testPaginaParam() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await context.newPage();

  const pagesToTest = [1, 2, 3, 5, 10, 50, 100, 358];

  for (const p of pagesToTest) {
    const url = `https://www.construja.com.br/produtos?pagina=${p}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const info = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]'));
      const firstTitle = cards[0]?.querySelector('[class*="CardProduto_tituloCardProduto"]')?.textContent?.trim() || 'NENHUM';
      const firstHref = cards[0]?.querySelector('a[href*="/produto/"]')?.getAttribute('href') || '';
      return {
        cardCount: cards.length,
        firstTitle,
        firstHref
      };
    });

    console.log(`Página ${String(p).padStart(3, ' ')} (${url}) => Cards: ${info.cardCount} | 1º Produto: "${info.firstTitle}" (${info.firstHref})`);
  }

  await context.close();
  await browser.close();
}

testPaginaParam().catch(console.error);
