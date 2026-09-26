import { chromium } from 'playwright';

async function inspectCards() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=COLORGIN');
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[class*="Produto"], div[class*="card"], div[class*="item"]'));
    return cards.slice(0, 5).map(c => ({
      className: c.className,
      innerText: c.innerText,
      html: c.innerHTML.substring(0, 500)
    }));
  });

  console.log('Sample cards structure:\n', JSON.stringify(info, null, 2));
  await browser.close();
}

inspectCards().catch(err => console.error(err));
