import { chromium } from 'playwright';

async function testCicalferRealB2BPrices() {
  console.log('🔑 TESTANDO CAPTURA DE PREÇOS REAIS DA CICALFER...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 868 }
  });
  const page = await context.newPage();

  console.log('1. Navegando para a homepage da Cicalfer...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Trigger login
  const loginTrigger = page.locator('button#botao-login, .dropdown:has-text("Entrar"), a:has-text("Entrar"), button:has-text("Faça Login")').first();
  if (await loginTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Clicando gatilho de login...');
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(2000);
  }

  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Preenchendo e-mail e senha...');
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
    await page.waitForTimeout(800);
    await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);

    const filialCard = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA"), .ModalClienteFilial_selectedTitle__uJhF8').first();
    if (await filialCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Selecionando filial ENTREGA...');
      await filialCard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);

      const confirmBtn = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
    console.log('✅ Login B2B e Seleção de Filial concluídos!');
  } else {
    console.warn('⚠️ Input de e-mail não ficou visível!');
  }

  // Test searching 3 random terms and capturing card prices from DOM
  const searchTerms = ['ABRAC', 'CABO', 'DUCHA', 'TIGRE'];

  for (const term of searchTerms) {
    console.log(`\n🔍 Buscando termo: "${term}"...`);
    await page.goto(`https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(term)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    const extractedProducts = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer, div[class*="itemContainer"], div[class*="ProdutoCompact"]'));
      return items.slice(0, 5).map((container) => {
        const title = container.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], h5, a')?.textContent?.trim() || '';
        const rawText = (container as HTMLElement).innerText || '';
        
        // Find price elements
        const priceEls = Array.from(container.querySelectorAll('.fs-14.fw-bold, span[class*="fw-bold"], span, div, p'))
          .map(e => (e.textContent || '').trim())
          .filter(t => /^R\$\s*[\d\.,]+/i.test(t));

        return { title, priceEls, rawTextSnippet: rawText.replace(/\s+/g, ' ').slice(0, 150) };
      });
    });

    console.log(`Resultados para "${term}": ${extractedProducts.length} itens encontrados no DOM.`);
    extractedProducts.forEach((p, idx) => {
      console.log(`  -> Item ${idx + 1}: ${p.title}`);
      console.log(`     Preços encontrados: ${JSON.stringify(p.priceEls)}`);
      console.log(`     Snippet: ${p.rawTextSnippet}`);
    });
  }

  await browser.close();
}

testCicalferRealB2BPrices().catch(console.error);
