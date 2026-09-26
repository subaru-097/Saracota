import { chromium } from 'playwright';

async function testLoginAndInspectPrices() {
  console.log('🔑 TESTANDO LOGIN B2B EXATO E CAPTURA DE PREÇOS...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click login button
  const loginBtn = page.locator('button#botao-login, button:has-text("Entrar"), .componentes-button_login').first();
  console.log('Clicking login button...');
  await loginBtn.click({ force: true });

  // Wait specifically for email input inside modal
  try {
    const emailInput = await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    console.log('✅ Modal de Login Aberto com Sucesso!');
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input[name="senha"], input[type="password"]').first().fill('871935');
    await page.waitForTimeout(500);

    await page.locator('button#btn-entrar, form button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(4000);

    // Filial Modal
    console.log('Verificando modal de filial...');
    const filialCard = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
    if (await filialCard.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Selecionando filial ENTREGA...');
      await filialCard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);

      const confirmBtn = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(4000);
      }
    }

    console.log('✅ Autenticado com sucesso no portal B2B Cicalfer!');

    // Inspect search API or DOM after authentication
    const searchRes = await page.evaluate(async () => {
      const payload = {
        page: 1,
        orderBy: { campo: 'descricaocompleta', modo: 'ASC' },
        filtros: { termo: 'CABO', produto_id: '', orcamento_id: '' },
      };
      const r = await fetch('https://api.cicalfer.com.br/v1/busca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await r.json();
    });

    console.log('\n📌 AMOSTRA DE PRODUTOS E PREÇOS APÓS AUTENTICAÇÃO:');
    if (searchRes && searchRes.itens) {
      searchRes.itens.slice(0, 5).forEach((it: any) => {
        console.log(`\n• [ID ${it.idExibicao}] ${it.descComp}`);
        console.log(`  Preço Direct: ${it.preco} | Preço Tabela: ${it.preco_tabela}`);
        console.log(`  Array Preços: ${JSON.stringify(it.precos)}`);
        console.log(`  Array Descontos: ${JSON.stringify(it.descontosTabela)}`);
      });
    }

  } catch (err: any) {
    console.error('❌ Erro no login:', err.message);
  }

  await browser.close();
}

testLoginAndInspectPrices().catch(console.error);
