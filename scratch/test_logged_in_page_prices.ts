import { chromium } from 'playwright';

async function testLoggedInPagePrices() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('1. Navegando para cicalfer.com.br...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  console.log('2. Efetuando login...');
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

  console.log('3. Selecionando filial ENTREGA...');
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

  console.log('4. Navegando para a página 1 da listagem autenticada...');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Extrair cards da página 1
  const cardData = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[class*="CardProduto"], div[class*="ProdutoCard"], .col-12, .col-md-4, .col-lg-3'));
    const results: any[] = [];
    cards.forEach(c => {
      const title = c.querySelector('a[href*="/produto/"], [class*="titulo"], [class*="Title"]')?.textContent?.trim();
      const code = c.querySelector('[class*="codigo"], [class*="Badge"], span:has-text("#")')?.textContent?.trim();
      const price = c.querySelector('.fs-14.fw-bold, span[class*="fw-bold"], [class*="preco"], [class*="Preco"]')?.textContent?.trim();
      const fullText = c.textContent || '';
      if (title && !results.some(r => r.title === title)) {
        results.push({ title, code, price, hasPrice: fullText.includes('R$') });
      }
    });
    return results;
  });

  console.log('📌 ITENS CAPTURADOS DA PÁGINA 1 AUTENTICADA:');
  console.log(JSON.stringify(cardData.slice(0, 10), null, 2));

  await browser.close();
}

testLoggedInPagePrices().catch(console.error);
