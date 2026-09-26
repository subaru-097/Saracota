import { chromium } from 'playwright';

async function inspectCicalferRealPrices() {
  console.log('🔍 Inspecionando estrutura de preços da API B2B Cicalfer...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  const emailInput = page.locator('input[name="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input[name="senha"], input[type="password"]').first().fill('871935');
    await page.locator('button#btn-entrar').first().click();
    await page.waitForTimeout(3500);

    const filialEntrega = page.locator('.ModalClienteFilial_selectedTitle__uJhF8, .modal:has-text("ENTREGA")').first();
    if (await filialEntrega.isVisible().catch(() => false)) {
      await filialEntrega.click().catch(() => {});
      await page.waitForTimeout(1000);
      const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
      }
    }
  }

  // Fetch page 1 from search API after login
  const res = await page.evaluate(async () => {
    const payload = {
      page: 1,
      orderBy: { campo: 'descricaocompleta', modo: 'ASC' },
      filtros: { termo: '', produto_id: '', orcamento_id: '' },
    };
    const r = await fetch('https://api.cicalfer.com.br/v1/busca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await r.json();
  });

  console.log(`Itens retornados: ${res?.itens?.length}`);

  if (res?.itens?.length > 0) {
    for (let i = 0; i < Math.min(5, res.itens.length); i++) {
      const it = res.itens[i];
      console.log(`\n--- PRODUTO ${i + 1}: ${it.descComp} (ID: ${it.idExibicao}) ---`);
      console.log('it.preco:', it.preco);
      console.log('it.preco_tabela:', it.preco_tabela);
      console.log('it.precos:', JSON.stringify(it.precos));
      console.log('it.descontosTabela:', JSON.stringify(it.descontosTabela));
      console.log('it.embalagens:', JSON.stringify(it.embalagens));
      
      // Look for any keys containing "preco", "valor", "val", "venda"
      const priceKeys = Object.keys(it).filter(k => /preco|valor|val|venda|custo|tabela/i.test(k));
      console.log('Price related keys:', priceKeys.map(k => `${k}: ${JSON.stringify(it[k])}`).join(', '));
    }
  }

  // Also check product price from DOM grid card directly!
  console.log('\n--- VERIFICANDO PREÇOS NO DOM DA PÁGINA (/produtos) ---');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=ABRAC', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const domCards = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer, [class*="product"], [class*="card"]'));
    return cards.slice(0, 5).map((card) => {
      const title = card.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, [class*="title"], h5, h6, strong')?.textContent || '';
      const priceText = Array.from(card.querySelectorAll('.fs-14.fw-bold, [class*="price"], span, div'))
        .map(e => (e.textContent || '').trim())
        .filter(t => t.includes('R$'));
      return { title, priceText };
    });
  });

  console.log('DOM Cards Price inspection:', JSON.stringify(domCards, null, 2));

  await browser.close();
}

inspectCicalferRealPrices().catch(console.error);
