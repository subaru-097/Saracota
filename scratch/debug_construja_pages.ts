import { chromium } from 'playwright';

const LOGIN_EMAIL = process.env.CONSTRUJA_EMAIL || process.env.CONSTRUJA_LOGIN || 'comercialsantana@gmail.com';
const LOGIN_PASS = process.env.CONSTRUJA_PASSWORD || '53597';

async function debugConstrujaPages() {
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

  const pagesToTest = [30, 31, 32, 33, 34, 35, 36, 40, 50, 100, 200, 350];

  for (const p of pagesToTest) {
    const url = `https://www.construja.com.br/produtos?pagina=${p}`;
    
    let cardsCount = 0;
    let title = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);

      const info = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]'));
        const firstTitle = cards[0]?.querySelector('[class*="CardProduto_tituloCardProduto"]')?.textContent?.trim() || '';
        return { cards: cards.length, firstTitle };
      });

      cardsCount = info.cards;
      title = info.firstTitle;

      if (cardsCount > 0) break;
      console.log(`   ⚠️ Tentativa #${attempt} para página ${p} retornou 0 cards. Aguardando 3s...`);
      await page.waitForTimeout(3000);
    }

    console.log(`Página ${String(p).padStart(3, ' ')} (${url}) => Cards: ${cardsCount} | 1º Produto: "${title}"`);
  }

  await context.close();
  await browser.close();
}

debugConstrujaPages().catch(console.error);
