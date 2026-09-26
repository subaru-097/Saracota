import { chromium } from 'playwright';

async function testFullAuthAndPrices() {
  console.log('🚀 TESTANDO FLUXO COMPLETO: ACEITAR COOKIES + LOGIN + FILIAL + PREÇOS REAIS...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 868 } });
  const page = await context.newPage();

  // 1. Acessar site
  console.log('1. Acessando https://cicalfer.com.br/produtos...');
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 2. Aceitar Cookies
  const cookieBtn = page.locator('button#botao-aceitar-todos, button:has-text("Aceitar todos")').first();
  if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Accepting Cookie Banner...');
    await cookieBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // 3. Clicar Botão Login
  console.log('Clicando em Entrar | Cadastrar...');
  const loginBtn = page.locator('button#botao-login').first();
  await loginBtn.click({ force: true });
  await page.waitForTimeout(1500);

  // 4. Preencher formulário de Login
  console.log('Preenchendo e-mail e senha B2B...');
  await page.fill('input[name="email"]', 'santanacomercial2021@gmail.com');
  await page.fill('input#senha[name="senha"], input[type="password"]', '871935');
  await page.waitForTimeout(500);

  console.log('Submetendo Login...');
  await page.click('button#btn-entrar').catch(() => {});
  await page.waitForTimeout(4000);

  // 5. Tratar Filial
  console.log('Selecionando Filial ENTREGA...');
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

  console.log('🎉 SESSÃO B2B 100% AUTENTICADA!');

  // 6. Testar 3 buscas no portal e capturar PREÇOS REAIS dos cards no DOM
  const searchTerms = ['ABRAC NYLON', 'CABO FLEX', 'DUCHA LORENZETTI'];

  for (const term of searchTerms) {
    console.log(`\n🔍 Buscando termo: "${term}"...`);
    await page.goto(`https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(term)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    const products = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer, div[class*="itemContainer"]'));
      return items.slice(0, 3).map((container) => {
        const title = container.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], h5, a')?.textContent?.trim() || '';
        
        // Find price elements containing R$
        const priceEls = Array.from(container.querySelectorAll('.fs-14.fw-bold, span[class*="fw-bold"], span, div, p'))
          .map(e => (e.textContent || '').trim())
          .filter(t => /^R\$\s*[\d\.,]+/i.test(t));

        return { title, priceEls };
      });
    });

    console.log(`Resultados para "${term}":`);
    products.forEach((p, idx) => {
      console.log(`  Item ${idx + 1}: ${p.title}`);
      console.log(`    Preços no DOM: ${JSON.stringify(p.priceEls)}`);
    });
  }

  await browser.close();
}

testFullAuthAndPrices().catch(console.error);
