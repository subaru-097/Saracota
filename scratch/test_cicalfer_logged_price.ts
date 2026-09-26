import { chromium } from 'playwright';

async function testLoggedPrice() {
  console.log('🔑 TESTANDO LOGIN COM CREDENCIAIS OFICIAIS SARACOTA (871935)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor all API responses
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('api.cicalfer.com.br/v1')) {
      try {
        const body = await res.json();
        const str = JSON.stringify(body);
        if (str.includes('preco') || str.includes('valor')) {
          console.log(`\n📥 API RES: ${url}`);
          console.log(`   Sample: ${str.slice(0, 300)}`);
        }
      } catch (e) {}
    }
  });

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click login trigger
  const loginTrigger = page.locator('text=Entrar | Cadastrar, button#botao-login, .dropdown:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    console.log('Clicando em Entrar | Cadastrar...');
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(1500);
  }

  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Preenchendo e-mail e senha...');
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
    await page.waitForTimeout(500);

    await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);

    // Filial selection
    const filialOption = page.locator('.ModalClienteFilial_selectedTitle__uJhF8, .modal:has-text("ENTREGA")').first();
    if (await filialOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Selecionando filial ENTREGA...');
      await filialOption.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);

      const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
    console.log('✅ Login B2B e Filial concluídos com sucesso!');
  }

  // Trigger search for product "CABO"
  console.log('\nNavegando para busca "CABO"...');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=CABO', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  // Extract prices from DOM cards
  const cards = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="product-card"], .MuiGrid-item'));
    return list.map((c) => {
      const title = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, [class*="productTitle"], h5, h6, strong')?.textContent || '';
      const text = (c.textContent || '').replace(/\s+/g, ' ');
      return { title, text };
    }).filter(x => x.text.length > 10);
  });

  console.log('\n📌 PRODUTOS E PREÇOS NO DOM APÓS LOGIN AUTENTICADO:');
  cards.slice(0, 5).forEach((c, idx) => {
    console.log(`\nCard ${idx + 1}: ${c.title}`);
    console.log(`   Text snippet: ${c.text.slice(0, 250)}`);
  });

  await browser.close();
}

testLoggedPrice().catch(console.error);
