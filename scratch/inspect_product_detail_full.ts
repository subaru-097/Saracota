import { chromium } from 'playwright';

async function testProductDetailFull() {
  console.log('🔍 EXTRAINDO PREÇO DO ENDPOINT DE PRODUTO INDIVIDUAL (/v1/produtos/{id})...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let jwtToken = '';

  page.on('response', async (res) => {
    if (res.url().includes('/v1/login/b2b')) {
      try {
        const d = await res.json();
        if (d?.token) jwtToken = d.token;
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

  const sampleIds = ['0000000034', '0000000024', '0000002899', '0000015456'];

  for (const id of sampleIds) {
    const detail = await page.evaluate(async ({ prodId, token }) => {
      try {
        const r = await fetch(`https://api.cicalfer.com.br/v1/produtos/${prodId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return await r.json();
      } catch (e: any) {
        return { error: e.message };
      }
    }, { prodId: id, token: jwtToken });

    console.log(`\n=====================================================`);
    console.log(`📌 PRODUTO ID: ${id}`);
    console.log('Chaves retornadas:', Object.keys(detail));
    console.log('JSON Completo:');
    console.log(JSON.stringify(detail, null, 2));
    console.log('=====================================================\n');
  }

  await browser.close();
}

testProductDetailFull().catch(console.error);
