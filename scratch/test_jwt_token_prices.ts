import { chromium } from 'playwright';

async function testJwtTokenPrices() {
  console.log('🔑 TESTANDO TOKEN JWT B2B CICALFER PARA EXTRAÇÃO DE PREÇOS...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Perform login via Playwright UI to obtain authenticated context & JWT token
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

  let jwtToken = '';

  page.on('response', async (res) => {
    if (res.url().includes('/v1/login/b2b')) {
      try {
        const data = await res.json();
        if (data && data.token) {
          jwtToken = data.token;
          console.log(`✅ JWT TOKEN CAPTURADO: ${jwtToken.slice(0, 35)}...`);
        }
      } catch (e) {}
    }
  });

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

  // Now test querying /v1/busca directly from page.evaluate passing JWT token headers or cookies
  console.log('\n--- TESTANDO POST /v1/busca COM HEADERS DE AUTENTICAÇÃO ---');
  const searchResult = await page.evaluate(async (token) => {
    try {
      const payload = {
        page: 1,
        orderBy: { campo: 'descricaocompleta', modo: 'ASC' },
        filtros: { termo: '', produto_id: '', orcamento_id: '' },
      };
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const r = await fetch('https://api.cicalfer.com.br/v1/busca', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      return await r.json();
    } catch (e: any) {
      return { error: e.message };
    }
  }, jwtToken);

  console.log(`Itens retornados: ${searchResult?.itens?.length}`);
  if (searchResult?.itens?.length > 0) {
    searchResult.itens.slice(0, 5).forEach((it: any, idx: number) => {
      console.log(`\n• Item ${idx + 1}: ${it.descComp}`);
      console.log(`  preco: ${it.preco}`);
      console.log(`  preco_tabela: ${it.preco_tabela}`);
      console.log(`  precos: ${JSON.stringify(it.precos)}`);
      console.log(`  descontosTabela: ${JSON.stringify(it.descontosTabela)}`);
    });
  }

  await browser.close();
}

testJwtTokenPrices().catch(console.error);
