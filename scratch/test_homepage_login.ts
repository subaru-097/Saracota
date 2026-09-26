import { chromium } from 'playwright';

async function testHomepageLogin() {
  console.log('🚀 TESTANDO LOGIN PELA HOMEPAGE DA CICALFER...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 868 } });
  const page = await context.newPage();

  console.log('1. Acessando https://cicalfer.com.br/...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Click login
  console.log('2. Clicando no botão de login...');
  const btn = page.locator('button#botao-login, button:has-text("Entrar")').first();
  await btn.click({ force: true });
  await page.waitForTimeout(2000);

  console.log('3. Preenchendo formulário...');
  await page.fill('input[name="email"]', 'santanacomercial2021@gmail.com');
  await page.fill('input[name="senha"], input[type="password"]', '871935');
  await page.waitForTimeout(500);

  console.log('4. Clicando entrar...');
  await page.click('button#btn-entrar').catch(() => {});
  await page.waitForTimeout(4000);

  console.log('5. Selecionando filial...');
  const filialCard = page.locator('.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
  if (await filialCard.isVisible({ timeout: 4000 }).catch(() => false)) {
    await filialCard.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);

    const confirmBtn = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(4000);
    }
  }

  console.log('✅ Login B2B e Filial concluídos! URL atual:', page.url());

  // Search 3 items and add to cart
  const items = [
    { termo: 'ABRAC NYLON BR 3,6 X 200MM', qty: 1 },
    { termo: 'CABO FLEX 100M COBRECOM 2,50MM AM', qty: 2 },
    { termo: 'DUCHA LORENZETTI BELLA DUCHA 127V', qty: 1 }
  ];

  for (const it of items) {
    console.log(`\nBuscando "${it.termo}"...`);
    await page.goto(`https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(it.termo)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    const buyBtn = page.locator('button#btn-comprar, button:has-text("Comprar"), button:has-text("Adicionar")').first();
    if (await buyBtn.isVisible().catch(() => false)) {
      await buyBtn.click({ force: true });
      await page.waitForTimeout(2500);
      console.log('  -> Adicionado ao carrinho!');
    }
  }

  // Navigate to cart
  console.log('\nNavegando para o carrinho (/carrinho)...');
  await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const cartContent = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer, div[class*="itemContainer"]'));
    return list.map(c => {
      const title = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, [class*="productTitle"], h5, a')?.textContent?.trim() || '';
      const prices = Array.from(c.querySelectorAll('.fs-14.fw-bold, span, div, p'))
        .map(el => (el.textContent || '').trim())
        .filter(t => /^R\$\s*[\d\.,]+/i.test(t));
      return { title, prices };
    });
  });

  console.log('\n=====================================================');
  console.log('📌 ITENS E PREÇOS REAIS B2B NO CARRINHO:');
  console.log(JSON.stringify(cartContent, null, 2));
  console.log('=====================================================\n');

  await browser.close();
}

testHomepageLogin().catch(console.error);
