import { chromium } from 'playwright';

async function testCicalferCartPrices() {
  console.log('🚀 TESTANDO EXTRAÇÃO DE PREÇOS REAIS DO CARRINHO CICALFER...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 868 } });

  // 1. Navegar para a página de produtos
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 2. Abrir modal de login usando seletor Playwright
  console.log('Abrindo modal de login...');
  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, text=Entrar | Cadastrar').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // 3. Preencher credenciais
  console.log('Preenchendo credenciais...');
  const emailInput = page.locator('input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input[name="senha"], input[type="password"]').first().fill('871935');
    await page.waitForTimeout(500);

    // 4. Submeter login
    await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);

    // 5. Tratar Filial B2B
    console.log('Tratando filial B2B...');
    const filialCard = page.locator('.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
    if (await filialCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filialCard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      const confirmBtn = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
    console.log('✅ Login B2B e Filial concluídos!');
  } else {
    console.warn('⚠️ Input de e-mail não visível!');
  }

  // 6. Adicionar 3 produtos ao carrinho
  const testSearchItems = [
    { termo: 'ABRAC NYLON BR 3,6 X 200MM', qty: 1 },
    { termo: 'CABO FLEX 100M COBRECOM 2,50MM AM', qty: 2 },
    { termo: 'BROXA ROMA RETANGULAR', qty: 3 },
  ];

  for (const item of testSearchItems) {
    console.log(`\nBuscando e adicionando ao carrinho: "${item.termo}"...`);
    await page.goto(`https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(item.termo)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const buyBtn = page.locator('button#btn-comprar, button:has-text("Comprar"), button:has-text("Adicionar")').first();
    if (await buyBtn.isVisible().catch(() => false)) {
      await buyBtn.click({ force: true });
      await page.waitForTimeout(2000);
      console.log('  -> Botão comprar clicado!');
    }
  }

  // 7. Navegar para o carrinho e extrair dados reais de preços
  console.log('\n7. Navegando para o carrinho para ler PREÇOS REAIS B2B...');
  await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const cartItems = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer, div[class*="itemContainer"]'));
    return containers.map((c) => {
      const title = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], h5, a')?.textContent?.trim() || '';
      
      const priceTexts = Array.from(c.querySelectorAll('.fs-14.fw-bold, span, p, div'))
        .map(el => (el.textContent || '').trim())
        .filter(t => /^R\$\s*[\d\.,]+/i.test(t));

      const qtyInput = c.querySelector('input[type="number"], input') as HTMLInputElement;
      const qty = qtyInput ? qtyInput.value : '1';

      return { title, priceTexts, qty };
    });
  });

  console.log('\n=====================================================');
  console.log('📌 ITENS E PREÇOS REAIS EXTRAÍDOS DO CARRINHO B2B:');
  console.log(JSON.stringify(cartItems, null, 2));
  console.log('=====================================================\n');

  await browser.close();
}

testCicalferCartPrices().catch(console.error);
