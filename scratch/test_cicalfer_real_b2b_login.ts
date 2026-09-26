import { chromium } from 'playwright';

async function testRealB2BLoginAndPrice() {
  console.log('🔑 TESTANDO LOGIN B2B REAL CICALFER E CAPTURA DE PREÇOS...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (res) => {
    if (res.url().includes('/v1/busca')) {
      try {
        const body = await res.json();
        if (body?.itens?.length > 0) {
          const item0 = body.itens[0];
          console.log(`\n📥 API /v1/busca Response item 0 (${item0.descComp}):`);
          console.log(`   precos: ${JSON.stringify(item0.precos)}`);
          console.log(`   preco: ${item0.preco}`);
          console.log(`   preco_tabela: ${item0.preco_tabela}`);
        }
      } catch (e) {}
    }
  });

  console.log('1. Acessando https://cicalfer.com.br/produtos...');
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click Entrar / Faça Login
  const loginTrigger = page.locator('.dropdown:has-text("Entrar"), a:has-text("Entrar"), button:has-text("Faça Login"), button:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    console.log('Clicando gatilho de login...');
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(1500);
  }

  // Preencher credenciais
  const emailInput = page.locator('input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Preenchendo e-mail e senha...');
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input[name="senha"], input[type="password"]').first().fill('871935');
    await page.waitForTimeout(500);
    await page.locator('button#btn-entrar, button[type="submit"]:has-text("Entrar")').first().click({ force: true });
    await page.waitForTimeout(4000);

    // Tratar Modal de Filial
    console.log('Verificando modal de filial...');
    const filialOption = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
    if (await filialOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filialOption.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      const confirmBtn = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
    console.log('✅ Login e Filial Selecionados!');
  } else {
    console.warn('⚠️ Input de e-mail não visível!');
  }

  // Inspect DOM cards after login
  const cards = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('[class*="ProdutoCompactCarrinho_itemContainer"], div.card'));
    return list.map((c) => {
      const title = c.querySelector('[class*="productTitle"], h5, h6, strong')?.textContent || '';
      const prices = Array.from(c.querySelectorAll('.fs-14.fw-bold, [class*="price"], span'))
        .map(el => (el.textContent || '').trim())
        .filter(t => t.includes('R$'));
      return { title, prices };
    });
  });

  console.log('\n📌 PREÇOS NOS CARDS APÓS LOGIN:');
  console.log(JSON.stringify(cards.slice(0, 5), null, 2));

  await browser.close();
}

testRealB2BLoginAndPrice().catch(console.error);
