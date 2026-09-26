import { chromium } from 'playwright';

async function testAuthApiPrices() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('cicalfer') && (url.includes('busca') || url.includes('produto') || url.includes('v1') || url.includes('preco'))) {
      console.log(`[HTTP RESPONSE] ${res.status()} ${url}`);
      try {
        const json = await res.json();
        console.log(`[RESPONSE BODY SAMPLE]:`, JSON.stringify(json).slice(0, 300));
      } catch (e) {}
    }
  });

  console.log('Navegando para produtos...');
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Fechar cookie modal
  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Fazer login
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
    console.log('Login e filial configurados!');
  }

  console.log('Recarregando /produtos para observar chamadas da página autenticada...');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  // Inspecionar o DOM dos produtos
  const cards = await page.evaluate(() => {
    const elems = Array.from(document.querySelectorAll('div[class*="CardProduto"], div.col-12, div.col-md-4, div.col-lg-3'));
    return elems.map(el => {
      const text = el.textContent || '';
      if (text.includes('REF:') || text.includes('R$')) {
        return text.replace(/\s+/g, ' ').trim();
      }
      return null;
    }).filter(Boolean).slice(0, 10);
  });

  console.log('--- CARDS DO DOM ---');
  console.log(cards);

  await browser.close();
}

testAuthApiPrices().catch(console.error);
