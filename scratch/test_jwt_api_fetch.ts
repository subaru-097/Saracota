import { chromium } from 'playwright';

async function testJwtFetch() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let jwtToken = '';

  page.on('response', async (res) => {
    if (res.url().includes('/v1/login/b2b')) {
      try {
        const json = await res.json();
        if (json.token) {
          jwtToken = json.token;
          console.log('🔑 JWT TOKEN OBTIDO DO LOGIN:', jwtToken.slice(0, 40) + '...');
        }
      } catch (e) {}
    }
  });

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
    await page.waitForTimeout(500);
    await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(3000);

    const filialEntrega = page.locator('.ModalClienteFilial_selectedTitle__uJhF8, .modal:has-text("ENTREGA")').first();
    if (await filialEntrega.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filialEntrega.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
      const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    }
  }

  await browser.close();

  if (jwtToken) {
    console.log('\n--- TESTANDO API BUSCA COM JWT TOKEN EM NODE.JS ---');

    // Tentar com Bearer token e variações de header
    const headersList = [
      { 'Authorization': `Bearer ${jwtToken}` },
      { 'authorization': `Bearer ${jwtToken}` },
      { 'x-token': jwtToken },
      { 'Authorization': jwtToken }
    ];

    for (let i = 0; i < headersList.length; i++) {
      const h = headersList[i];
      console.log(`\nTentativa Header ${i + 1}:`, Object.keys(h)[0]);
      try {
        const res = await fetch('https://api.cicalfer.com.br/v1/busca?page=1', {
          headers: {
            ...h,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        });
        const data: any = await res.json();
        if (data.itens && data.itens.length > 0) {
          const item1 = data.itens[0];
          console.log(`Item: "${item1.descComp}"`);
          console.log(`precos array:`, item1.precos);
          console.log(`preco prop:`, item1.preco);
        }
      } catch (err: any) {
        console.error('Erro no fetch:', err.message);
      }
    }
  } else {
    console.error('Não foi possível obter o JWT token.');
  }
}

testJwtFetch().catch(console.error);
