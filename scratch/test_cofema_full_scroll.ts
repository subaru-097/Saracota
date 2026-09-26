import { chromium } from 'playwright';

async function testFullCategoryScroll(catUrl: string, catName: string) {
  console.log(`================================================================================`);
  console.log(`🧪 TESTING SCROLL FOR: ${catName}`);
  console.log(`🔗 ${catUrl}`);
  console.log(`================================================================================`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    }
  });

  const page = await context.newPage();

  console.log('1. Establishing session at home page...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  console.log(`2. Navigating to ${catName} via page.goto...`);
  await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(4000);

  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const meta = await page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const match = text.match(/(\d+)\s*produtos\s*encontrados/i) || text.match(/(\d+)\s*produtos/i);
    const title = document.querySelector('h1, h2, h3.text-2xl, h3')?.textContent?.trim() || '';
    return {
      title,
      totalEsperado: match ? parseInt(match[1], 10) : 0
    };
  });
  console.log(`🎯 Meta de Validação: ${meta.totalEsperado} produtos esperados ("${meta.title}")`);

  const uniqueProducts = new Map<string, { id: string; name: string; href: string }>();
  let scrollRound = 0;
  let stallRounds = 0;
  let lastUniqueCount = 0;

  while (scrollRound < 30) {
    scrollRound++;

    const domProducts = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[aria-label^="Ver produto"]'));
      return links.map(a => {
        const ariaLabel = a.getAttribute('aria-label') || '';
        const href = a.getAttribute('href') || '';
        const name = ariaLabel.replace(/^Ver produto\s*/i, '').trim();
        const match = href.match(/\/produto\/(\d+)-/);
        const id = match ? match[1] : '';
        return { id, name, href };
      }).filter(x => x.id && x.name);
    });

    domProducts.forEach(p => uniqueProducts.set(p.id, p));

    const currentUniqueCount = uniqueProducts.size;
    const domCount = domProducts.length;

    if (currentUniqueCount > lastUniqueCount) {
      stallRounds = 0;
    } else {
      stallRounds++;
    }

    console.log(`[Scroll #${scrollRound}] Cards no DOM: ${domCount} | Unique SKUs: ${currentUniqueCount} | Diff: +${currentUniqueCount - lastUniqueCount}`);

    lastUniqueCount = currentUniqueCount;

    if (meta.totalEsperado > 0 && currentUniqueCount >= meta.totalEsperado) {
      console.log(`✅ META ALCANÇADA! ${currentUniqueCount} / ${meta.totalEsperado} produtos capturados.`);
      break;
    }

    if (stallRounds >= 5) {
      console.log('🔄 Tentando recuperar scroll descolando...');
      await page.evaluate(() => window.scrollBy(0, -500));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      if (stallRounds >= 8) break;
    } else {
      await page.mouse.wheel(0, 2500);
      await page.waitForTimeout(1200);
    }
  }

  console.log(`\n📊 RESULTADO FINAL ${catName}:`);
  console.log(`- Esperado: ${meta.totalEsperado}`);
  console.log(`- Únicos Coletados: ${uniqueProducts.size}`);

  await browser.close();
}

testFullCategoryScroll('https://www.cofema.com.br/page/categoria/03', 'Hidráulica').catch(console.error);
