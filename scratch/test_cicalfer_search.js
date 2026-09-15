const { chromium } = require('playwright');

async function tentarAceitarCookies(page) {
  try {
    const botaoCookies = await page.waitForSelector('#botao-aceitar-todos', { timeout: 3000 });
    if (botaoCookies) {
      await botaoCookies.click();
      console.log('[RPA] Banner de cookies detectado e aceito.');
    }
  } catch {
    console.log('[RPA] Nenhum banner de cookies detectado, seguindo cotação.');
  }
}


(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('1. Aceitando cookies no Cicalfer...');
  await page.goto('https://cicalfer.com.br', { waitUntil: 'commit' });
  await tentarAceitarCookies(page);

  const termos = ['Cabo Flex 2.5mm', 'Cabo Flex 2,5', 'CABO FLEX 2,50MM'];
  for (const termo of termos) {
    const termNormalized = termo.replace(/(\d+)\.(\d+)/g, '$1,$2').replace(/mm/gi, '').trim();
    await page.goto(`https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(termNormalized)}`, { waitUntil: 'networkidle' });
    const count = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/produto/"]'));
      return links.filter(a => a.innerText.trim() && !a.innerText.startsWith('#')).length;
    });
    console.log(`Original "${termo}" -> Busca "${termNormalized}": ${count} produtos encontrados.`);
  }




  await browser.close();
})();
