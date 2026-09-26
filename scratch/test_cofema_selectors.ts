import { chromium } from 'playwright';

async function testCofemaSelectors() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('1. Navegando para Cofema...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Fechar cookie modal se presente
  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  console.log('2. Inspecionando h3 e links a[aria-label^="Ver produto"]...');
  const data = await page.evaluate(() => {
    const h3List = Array.from(document.querySelectorAll('h3')).map(h => h.textContent?.trim());
    const links = Array.from(document.querySelectorAll('a[aria-label^="Ver produto"]')).map(a => ({
      ariaLabel: a.getAttribute('aria-label'),
      href: a.getAttribute('href'),
    }));
    const verTodosBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.includes('Ver todos')).map(b => b.textContent?.trim());

    return {
      h3List,
      verTodosBtnsCount: verTodosBtns.length,
      linksSample: links.slice(0, 5)
    };
  });

  console.log('📌 RESULTADO DA INSPEÇÃO NA HOME DA COFEMA:');
  console.log(JSON.stringify(data, null, 2));

  await browser.close();
}

testCofemaSelectors().catch(console.error);
