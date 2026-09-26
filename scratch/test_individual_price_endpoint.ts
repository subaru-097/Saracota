import { chromium } from 'playwright';

async function testIndividualPriceEndpoint() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

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

  console.log('2. Testando chamadas a /v1/produtos/{id}/precos via page.evaluate...');

  const sampleSkus = ['0000000034', '0000000042', '0000002091', '0000000214', '0000000208'];

  for (const id of sampleSkus) {
    const res = await page.evaluate(async (prodId) => {
      try {
        const r = await fetch(`https://api.cicalfer.com.br/v1/produtos/${prodId}/precos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'app': 'VCOM'
          },
          body: JSON.stringify({ filtros: {} })
        });
        return await r.json();
      } catch (e: any) {
        return { error: e.message };
      }
    }, id);

    console.log(`\n📌 PRODUTO ${id}:`);
    console.log(`Desc: "${res.descComp}"`);
    console.log(`precos:`, JSON.stringify(res.precos));
    console.log(`preco prop:`, res.preco);
  }

  await browser.close();
}

testIndividualPriceEndpoint().catch(console.error);
