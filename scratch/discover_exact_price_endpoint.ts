import { chromium } from 'playwright';

async function discoverExactPriceEndpoint() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('api.cicalfer.com.br') || url.includes('cicalfer.com.br')) {
      try {
        const text = await res.text();
        if (text.includes('10600') || text.includes('592') || text.includes('7,72') || text.includes('7.72') || text.includes('preco')) {
          console.log(`\n📌 [HTTP ${res.status()}] ${res.request().method()} ${url}`);
          console.log(`Request Headers:`, JSON.stringify(res.request().headers(), null, 2));
          if (res.request().postData()) console.log(`Request PostData:`, res.request().postData());
          console.log(`Response Snippet (first 400 chars):`, text.slice(0, 400));
        }
      } catch (e) {}
    }
  });

  console.log('1. Navegando para cicalfer.com.br...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  console.log('2. Efetuando login...');
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

  console.log('3. Selecionando filial ENTREGA...');
  const filialEntrega = page.locator('.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
  if (await filialEntrega.isVisible({ timeout: 4000 }).catch(() => false)) {
    await filialEntrega.click({ force: true });
    await page.waitForTimeout(1000);
    const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(3000);
    }
  }

  console.log('4. Navegando para a página de produto específico (ex: 10600)...');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=10600', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  console.log('5. Clicando no produto para ir para a página de detalhes...');
  const prodLink = page.locator('a[href*="/produto/"]').first();
  if (await prodLink.isVisible().catch(() => false)) {
    await prodLink.click();
    await page.waitForTimeout(4000);
  }

  await browser.close();
}

discoverExactPriceEndpoint().catch(console.error);
