import { chromium } from 'playwright';

async function inspectOrcamentoApi() {
  console.log('🔍 Interceptando TODAS as APIs da Cicalfer durante sessão real...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('api.cicalfer.com.br')) {
      try {
        const text = await res.text();
        if (text.includes('{') || text.includes('[')) {
          console.log(`\n--------------------------------------------------`);
          console.log(`📡 API: [${res.request().method()}] ${url}`);
          console.log(`   Status: ${res.status()}`);
          console.log(`   Snippet: ${text.slice(0, 400)}`);
          console.log(`--------------------------------------------------`);
        }
      } catch (e) {}
    }
  });

  // 1. Acessar produtos
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 2. Aceitar cookies
  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // 3. Abrir login
  const loginBtn = page.locator('button#botao-login').first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  // 4. Preencher login
  const emailInput = page.locator('input[name="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);

    // Filial selection
    const filialOption = page.locator('.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
    if (await filialOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filialOption.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      const confirmBtn = page.locator('span:has-text("Confirmar seleção")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
  }

  // 5. Ir para /carrinho ou adicionar item
  console.log('Navegando para o carrinho...');
  await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  await browser.close();
}

inspectOrcamentoApi().catch(console.error);
