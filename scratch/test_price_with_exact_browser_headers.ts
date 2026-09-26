import { chromium } from 'playwright';

async function testPriceWithExactHeaders() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let capturedHeaders: any = null;

  page.on('request', req => {
    if (req.url().includes('/v1/carga') || req.url().includes('/v1/vitrines') || req.url().includes('/v1/busca')) {
      const h = req.headers();
      if (h['authorization'] && !capturedHeaders) {
        capturedHeaders = h;
        console.log('🔑 HEADERS CAPTURADOS DO NAVEGADOR:');
        console.log(JSON.stringify(h, null, 2));
      }
    }
  });

  console.log('1. Autenticando no portal B2B Cicalfer...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(1000);
  }

  await page.locator('input[name="email"].form-control, input[name="email"]').first().fill('santanacomercial2021@gmail.com');
  await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
  await page.waitForTimeout(500);
  await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
  await page.waitForTimeout(3500);

  const filialEntrega = page.locator('.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
  if (await filialEntrega.isVisible({ timeout: 4000 }).catch(() => false)) {
    await filialEntrega.click({ force: true });
    await page.waitForTimeout(1000);
    const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(3500);
    }
  }

  console.log('2. Extraindo token e headers do localStorage/sessionStorage...');
  const clientInfo = await page.evaluate(() => {
    const rawState = localStorage.getItem('persist:cliente') || localStorage.getItem('persist:auth') || '{}';
    return {
      localStorage: { ...localStorage },
      rawState
    };
  });
  console.log('Client State:', JSON.stringify(clientInfo, null, 2));

  // Agora vamos testar a chamada fetch com os headers capturados
  if (capturedHeaders) {
    console.log('\n3. Testando POST /v1/produtos/0000000034/precos com headers completos...');
    const res = await page.evaluate(async (headers) => {
      try {
        const r = await fetch('https://api.cicalfer.com.br/v1/produtos/0000000034/precos', {
          method: 'POST',
          headers: {
            ...headers,
            'content-type': 'application/json'
          },
          body: JSON.stringify({ filtros: {} })
        });
        return await r.json();
      } catch (e: any) {
        return { error: e.message };
      }
    }, capturedHeaders);

    console.log('Response de precos:', JSON.stringify(res, null, 2));
  }

  await browser.close();
}

testPriceWithExactHeaders().catch(console.error);
