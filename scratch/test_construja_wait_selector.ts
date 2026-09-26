import { chromium } from 'playwright';

const LOGIN_EMAIL = process.env.CONSTRUJA_EMAIL || process.env.CONSTRUJA_LOGIN || 'comercialsantana@gmail.com';
const LOGIN_PASS = process.env.CONSTRUJA_PASSWORD || '53597';

async function testWaitSelector() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await context.newPage();

  console.log('🔑 Realizando login B2B na Construjá...');
  await page.goto('https://www.construja.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2500);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

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

  await page.waitForTimeout(4000);
  console.log('✅ Login B2B realizado com sucesso.');

  const pagesToTest = [1, 2, 5, 10, 20, 30, 40, 50, 100, 200, 350, 358];

  for (const pageNum of pagesToTest) {
    const pageUrl = `https://www.construja.com.br/produtos?pagina=${pageNum}`;
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

    // Aguardar explicitamente o surgimento do seletor de cards no DOM
    const hasCards = await page.waitForSelector('div[class*="CardProduto_cardBodyContainer"]', { timeout: 12000 }).catch(() => null);

    const cards = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]'));
      const firstTitle = elements[0]?.querySelector('[class*="CardProduto_tituloCardProduto"]')?.textContent?.trim() || '';
      return { count: elements.length, firstTitle };
    });

    console.log(`Página ${String(pageNum).padStart(3, ' ')} (${pageUrl}) => HasSelector: ${Boolean(hasCards)} | Cards: ${cards.count} | 1º Produto: "${cards.firstTitle}"`);
  }

  await context.close();
  await browser.close();
}

testWaitSelector().catch(console.error);
