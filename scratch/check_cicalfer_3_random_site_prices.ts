import { chromium } from 'playwright';

async function check3RandomSitePrices() {
  console.log('🔍 VERIFICANDO PREÇOS REAIS DE 5 PRODUTOS ALEATÓRIOS NO CARRINHO CICALFER B2B...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 868 } });
  const page = await context.newPage();

  // Login B2B
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const cookieBtn = page.locator('button#botao-aceitar-todos, button:has-text("Aceitar todos")').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }

  const loginBtn = page.locator('button#botao-login').first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const emailInput = page.locator('input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);

    const filialCard = page.locator('.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
    if (await filialCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filialCard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      const confirmBtn = page.locator('span:has-text("Confirmar seleção")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
  }

  console.log('✅ Login B2B e Filial concluídos!');

  const testSkus = [
    { sku: '10600', nome: 'ABRAC NYLON BR 3,6 X 200MM' },
    { sku: '10666', nome: 'CABO FLEX 100M COBRECOM 1,50MM AM' },
    { sku: '12709', nome: 'VEDA ROSCA FORTLEV 18MM X 10M' },
    { sku: '14967', nome: 'VERNIZ POLIREX REST IMBUIA 3,6L' },
    { sku: '10738', nome: 'VALVULA TANQUE PLAST ASTRA' },
  ];

  for (const item of testSkus) {
    console.log(`\nAdicionando SKU #${item.sku} ("${item.nome}") ao carrinho...`);
    await page.goto(`https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(item.sku)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const buyBtn = page.locator('button:has-text("Comprar"), button:has-text("Adicionar"), button#btn-comprar, [class*="button_login"]').first();
    if (await buyBtn.isVisible().catch(() => false)) {
      await buyBtn.click({ force: true }).catch(() => {});
      console.log('  -> Botão comprar clicado!');
      await page.waitForTimeout(2000);

      // Tratar modal de orçamento se aparecer
      const modalBtn = page.locator('button:has-text("Confirmar alteração"), button:has-text("Confirmar")').first();
      if (await modalBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await modalBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1500);
      }
    } else {
      console.log('  -> Botão comprar não visível');
    }
  }

  console.log('\nNavegando para o carrinho (/carrinho) para extrair os PREÇOS REAIS B2B...');
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
  console.log('📌 COMPARATIVO DE PREÇOS REAIS NO CARRINHO B2B:');
  console.log(JSON.stringify(cartItems, null, 2));
  console.log('=====================================================\n');

  await browser.close();
}

check3RandomSitePrices().catch(console.error);
