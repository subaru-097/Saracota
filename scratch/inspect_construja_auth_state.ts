import { chromium } from 'playwright';

const LOGIN_EMAIL = process.env.CONSTRUJA_EMAIL || process.env.CONSTRUJA_LOGIN || 'comercialsantana@gmail.com';
const LOGIN_PASS = process.env.CONSTRUJA_PASSWORD || '53597';

async function inspectAuthState() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await context.newPage();

  console.log('1️⃣ Acessando homepage...');
  await page.goto('https://www.construja.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  console.log('2️⃣ Efetuando Login...');
  const loginLink = page.locator('a[href*="/login"], button:has-text("Entre"), span:has-text("Entre"), a:has-text("Entre")').first();
  if (await loginLink.isVisible().catch(() => false)) {
    await loginLink.click();
    await page.waitForTimeout(2000);
  }

  const modal = page.locator('.modal-login, div[role="dialog"]').first();
  const isModalVisible = await modal.isVisible().catch(() => false);
  const container = isModalVisible ? modal : page.locator('body');

  const emailInput = container.locator('input[type="email"], input[name*="email"], input[name*="login"], input[placeholder*="email" i], input[placeholder*="cpf" i]').first();
  const passInput = container.locator('input[type="password"], input[name*="senha"], input[name*="pass"], input[placeholder*="senha" i]').first();

  await emailInput.fill(LOGIN_EMAIL);
  await passInput.fill(LOGIN_PASS);

  const submitBtn = container.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar"), button:has-text("Login")').first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
  } else {
    await passInput.press('Enter');
  }

  await page.waitForTimeout(5000);

  // Inspecionar Cookies, LocalStorage e SessionStorage
  const storageState = await page.evaluate(() => {
    const local = { ...localStorage };
    const session = { ...sessionStorage };
    const cookies = document.cookie;
    return { localKeys: Object.keys(local), sessionKeys: Object.keys(session), cookies };
  });

  console.log('3️⃣ Storage State após login:', JSON.stringify(storageState, null, 2));

  // Testar navegar clicando no botão "Nossos Produtos" ou link no menu principal
  const prodLink = page.locator('a[href*="/produtos"], span:has-text("Produtos"), a:has-text("Produtos")').first();
  if (await prodLink.isVisible().catch(() => false)) {
    console.log('4️⃣ Clicando no link "Produtos" da interface...');
    await prodLink.click();
    await page.waitForTimeout(4000);
  } else {
    console.log('4️⃣ Indo via window.location.href...');
    await page.evaluate(() => { window.location.href = 'https://www.construja.com.br/produtos'; });
    await page.waitForTimeout(4000);
  }

  const resultState = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]'));
    const title1 = cards[0]?.querySelector('[class*="CardProduto_tituloCardProduto"]')?.textContent?.trim() || '';
    const price1 = cards[0]?.querySelector('div[class*="CardProduto_precoCardProduto"], [class*="preco"]')?.textContent?.trim() || '';
    return { cardCount: cards.length, title1, price1, currentUrl: window.location.href };
  });

  console.log('5️⃣ Estado da página de produtos:', JSON.stringify(resultState, null, 2));

  await context.close();
  await browser.close();
}

inspectAuthState().catch(console.error);
