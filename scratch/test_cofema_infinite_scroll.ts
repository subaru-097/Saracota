import { chromium } from 'playwright';

async function testCofemaInfiniteScroll() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('1. Navegando para a categoria Elétrica (categoria/04)...');
  await page.goto('https://www.cofema.com.br/page/categoria/04', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Fechar cookie modal se houver
  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // 1. Capturar header com "X produtos encontrados"
  const headerInfo = await page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const match = text.match(/(\d+)\s*produtos\s*encontrados/i) || text.match(/(\d+)\s*produtos/i);
    const h1Text = document.querySelector('h1, h2, h3')?.textContent?.trim();
    return {
      h1Text,
      totalEsperadoText: match ? match[0] : 'NÃO ENCONTRADO',
      totalEsperadoNum: match ? parseInt(match[1], 10) : 0,
      snippet: text.slice(0, 300)
    };
  });

  console.log('📌 HEADER CAPTURADO NA PÁGINA DA CATEGORIA:');
  console.log(JSON.stringify(headerInfo, null, 2));

  // 2. Testar 5 rodadas de scroll incremental
  console.log('\n2. Testando loop de scroll incremental (5 rodadas)...');
  for (let round = 1; round <= 5; round++) {
    const countBefore = await page.locator('a[aria-label^="Ver produto"]').count();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    const countAfter = await page.locator('a[aria-label^="Ver produto"]').count();
    console.log(`  Rodada ${round}: Itens no DOM de ${countBefore} -> ${countAfter} (+${countAfter - countBefore})`);
  }

  await browser.close();
}

testCofemaInfiniteScroll().catch(console.error);
