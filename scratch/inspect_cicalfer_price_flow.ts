import { chromium } from 'playwright';

async function inspectPriceFlow() {
  console.log('🔍 Investigando de onde vem o PREÇO no portal Cicalfer...');
  const browser = await chromium.launch({ headless: false }); // Headless false for full visibility
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('api.cicalfer') && !url.includes('.css') && !url.includes('.png') && !url.includes('.jpg')) {
      try {
        const json = await res.json();
        const str = JSON.stringify(json);
        if (str.includes('preco') || str.includes('valor') || str.includes('total') || str.includes('tabela')) {
          console.log(`\n---------------------------------------------------`);
          console.log(`📥 API URL com PREÇO: ${url}`);
          console.log(`   Response snippet: ${str.slice(0, 300)}`);
          console.log(`---------------------------------------------------\n`);
        }
      } catch (e) {}
    }
  });

  console.log('1. Navegando para a página de produtos...');
  await page.goto('https://cicalfer.com.br/produtos');
  await page.waitForTimeout(3000);

  console.log('2. Efetuando Login...');
  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);

    const filialEntrega = page.locator('.ModalClienteFilial_selectedTitle__uJhF8, .modal:has-text("ENTREGA")').first();
    if (await filialEntrega.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filialEntrega.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
  }

  console.log('3. Buscando produto "CABO"...');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=CABO');
  await page.waitForTimeout(5000);

  // Inspect visible card elements in DOM
  const cardData = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[class*="Produto"], div[class*="card"], div[class*="Item"]'));
    return cards.map(c => (c.textContent || '').trim()).filter(t => t.length > 10).slice(0, 5);
  });

  console.log('\nTextos dos cards no DOM:');
  cardData.forEach((txt, idx) => {
    console.log(`Card ${idx + 1}: ${txt.slice(0, 200)}...`);
  });

  await page.waitForTimeout(5000);
  await browser.close();
}

inspectPriceFlow().catch(console.error);
