import { chromium } from 'playwright';

async function inspectB2bApiCalls() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  page.on('request', req => {
    const url = req.url();
    if (url.includes('api.cicalfer.com.br')) {
      console.log(`[REQ] ${req.method()} ${url}`);
      console.log(`  Headers:`, JSON.stringify(req.headers()));
      if (req.postData()) {
        console.log(`  PostData:`, req.postData()?.slice(0, 300));
      }
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('api.cicalfer.com.br')) {
      try {
        const text = await res.text();
        if (text.includes('preco') || text.includes('valor') || text.includes('item') || text.includes('0000')) {
          console.log(`[RES SAMPLE ${url}]:`, text.slice(0, 300));
        }
      } catch (e) {}
    }
  });

  console.log('1. Navegando para site...');
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  console.log('2. Efetuando login...');
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
        await page.waitForTimeout(3000);
      }
    }
  }

  console.log('3. Buscando produto na barra de busca...');
  const searchInput = page.locator('input[placeholder*="Buscar"], input[type="text"]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('10600');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);
  }

  await browser.close();
}

inspectB2bApiCalls().catch(console.error);
