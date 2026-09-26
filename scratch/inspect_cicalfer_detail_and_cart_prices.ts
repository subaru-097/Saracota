import { chromium } from 'playwright';

async function testDetailAndCartPrices() {
  console.log('🔍 INSPECIONANDO ONDE OS PREÇOS SÃO CALCULADOS NA CICALFER...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let jwtToken = '';

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/v1/login/b2b')) {
      try {
        const data = await res.json();
        if (data?.token) jwtToken = data.token;
      } catch (e) {}
    }
  });

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
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

  console.log('Testing product endpoints with token:', jwtToken.slice(0, 25));

  // Test product detail endpoints: /v1/produtos/0000000034, /v1/orcamento/atual, /v1/carrinho
  const endpointsToTest = [
    'https://api.cicalfer.com.br/v1/produtos/0000000034',
    'https://api.cicalfer.com.br/v1/produtos/10600',
    'https://api.cicalfer.com.br/v1/orcamentos/atual',
    'https://api.cicalfer.com.br/v1/orcamentos/itens',
    'https://api.cicalfer.com.br/v1/cliente/limites',
    'https://api.cicalfer.com.br/v1/tabela-preco',
  ];

  for (const url of endpointsToTest) {
    const res = await page.evaluate(async ({ url, token }) => {
      try {
        const r = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        return { status: r.status, data: await r.json() };
      } catch (e: any) {
        return { error: e.message };
      }
    }, { url, token: jwtToken });

    console.log(`\nURL: ${url}`);
    console.log(`  Result:`, JSON.stringify(res).slice(0, 350));
  }

  await browser.close();
}

testDetailAndCartPrices().catch(console.error);
