import { chromium } from 'playwright';

async function inspectFullApiPrice() {
  console.log('🔍 Inspecionando resposta da API B2B Cicalfer...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Intercept response of /v1/busca
  page.on('response', async (res) => {
    if (res.url().includes('/v1/busca')) {
      try {
        const body = await res.json();
        if (body && body.itens && body.itens.length > 0) {
          console.log('\n=====================================================');
          console.log(`📥 API /v1/busca retornou ${body.itens.length} itens.`);
          const item0 = body.itens[0];
          console.log('Item 0 completo:');
          console.log(JSON.stringify(item0, null, 2));
          console.log('=====================================================\n');
        }
      } catch (e) {}
    }
  });

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(3000);

    const filialEntrega = page.locator('.ModalClienteFilial_selectedTitle__uJhF8, .modal:has-text("ENTREGA")').first();
    if (await filialEntrega.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filialEntrega.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
      const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1500);
      }
    }
  }

  // Trigger search
  const searchInput = page.locator('input[name="search"], input[name="q"], input[type="search"]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('CABO');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
  } else {
    // Navigate to product page
    await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=CABO', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // Extract DOM price of visible items
  const domPrices = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[class*="ProdutoCompactCarrinho"], [class*="product-card"], .MuiGrid-item'));
    return items.map((it) => {
      const text = (it.textContent || '').replace(/\s+/g, ' ');
      return text;
    }).filter(t => t.includes('REF') || t.includes('R$'));
  });

  console.log('DOM Items Texts count:', domPrices.length);
  if (domPrices.length > 0) {
    console.log('Sample DOM item 0 text:', domPrices[0]);
    console.log('Sample DOM item 1 text:', domPrices[1]);
  }

  await browser.close();
}

inspectFullApiPrice().catch(console.error);
