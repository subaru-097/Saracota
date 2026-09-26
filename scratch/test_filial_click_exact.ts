import { chromium } from 'playwright';

async function testFilialClickExact() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('api.cicalfer.com.br') && !url.includes('.jpg') && !url.includes('.css')) {
      console.log(`[HTTP ${res.status()}] ${res.request().method()} ${url}`);
      if (res.request().headers()['authorization']) {
        console.log(`  Auth: ${res.request().headers()['authorization'].slice(0, 30)}...`);
      }
      if (res.request().headers()['filial-id']) {
        console.log(`  Filial-ID: ${res.request().headers()['filial-id']}`);
      }
      if (res.request().headers()['cliente-id']) {
        console.log(`  Cliente-ID: ${res.request().headers()['cliente-id']}`);
      }
    }
  });

  console.log('1. Navegando para cicalfer.com.br...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // ACEITAR COOKIES
  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    console.log('Clicando em aceitar cookies...');
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // BOTÃO LOGIN
  console.log('Clicando em login...');
  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar")').first();
  await loginTrigger.click({ force: true });
  await page.waitForTimeout(1500);

  // PREENCHER FORMULARIO
  console.log('Preenchendo credenciais...');
  await page.locator('input[name="email"].form-control, input[name="email"]').first().fill('santanacomercial2021@gmail.com');
  await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
  await page.waitForTimeout(500);
  await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
  await page.waitForTimeout(3500);

  // SELECIONAR FILIAL
  console.log('Procurando modal de filial...');
  const filialEntrega = page.locator('.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
  if (await filialEntrega.isVisible({ timeout: 4000 }).catch(() => false)) {
    console.log('Filial ENTREGA encontrada. Clicando...');
    await filialEntrega.click({ force: true });
    await page.waitForTimeout(1000);
    const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicando em Confirmar seleção...');
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(3000);
    }
  }

  // VERIFICAR LOCALSTORAGE
  const storage = await page.evaluate(() => {
    return {
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage }
    };
  });
  console.log('📌 LOCALSTORAGE / SESSIONSTORAGE APÓS SELEÇÃO DE FILIAL:');
  console.log(JSON.stringify(storage, null, 2));

  await browser.close();
}

testFilialClickExact().catch(console.error);
