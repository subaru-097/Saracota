import { chromium } from 'playwright';

async function testScrapeLoggedInPages() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('1. Autenticando no portal B2B Cicalfer...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(1000);
  }

  await page.locator('input[name="email"].form-control, input[name="email"]').first().fill('santanacomercial2021@gmail.com');
  await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
  await page.waitForTimeout(500);
  await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
  await page.waitForTimeout(3500);

  console.log('2. Selecionando filial ENTREGA...');
  const filialEntrega = page.locator('.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
  if (await filialEntrega.isVisible({ timeout: 4000 }).catch(() => false)) {
    await filialEntrega.click({ force: true });
    await page.waitForTimeout(1000);
    const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(3500);
    }
  }

  console.log('3. Testando navegação nas páginas 1 e 2 com extração de preços reais do DOM...');

  for (let p = 1; p <= 2; p++) {
    console.log(`\nNavegando para https://cicalfer.com.br/produtos?pagina=${p}...`);
    await page.goto(`https://cicalfer.com.br/produtos?pagina=${p}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const pageProducts = await page.evaluate(() => {
      // Procurar todos os cards de produtos renderizados
      const cards = Array.from(document.querySelectorAll('div[class*="CardProduto"], div[class*="card"]'));
      const items: any[] = [];

      cards.forEach(card => {
        const fullTxt = card.textContent || '';
        if (fullTxt.includes('REF:')) {
          const title = card.querySelector('a[href*="/produto/"], [class*="titulo"]')?.textContent?.trim() || '';
          const refMatch = fullTxt.match(/REF:\s*(\d+)/i) || fullTxt.match(/#(\d+)/);
          const priceMatch = fullTxt.match(/R\$\s*[\d\.,]+/);
          if (title && refMatch) {
            items.push({
              ref: refMatch[1],
              title,
              priceStr: priceMatch ? priceMatch[0] : 'NÃO ENCONTRADO',
              fullSnippet: fullTxt.slice(0, 150)
            });
          }
        }
      });
      return items;
    });

    console.log(`Página ${p} - Extraídos ${pageProducts.length} itens:`);
    console.log(JSON.stringify(pageProducts.slice(0, 5), null, 2));
  }

  await browser.close();
}

testScrapeLoggedInPages().catch(console.error);
