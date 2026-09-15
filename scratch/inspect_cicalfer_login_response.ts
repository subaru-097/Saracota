import { chromium } from 'playwright';
import path from 'path';

(async () => {
  console.log('=== INSPEÇÃO DO RESPONSE DA API DE LOGIN DA CICALFER ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  page.on('response', async (res) => {
    if (res.url().includes('login') || res.url().includes('auth') || res.url().includes('session') || res.url().includes('api')) {
      console.log(`[NETWORK RESPONSE] Status ${res.status()} - URL: ${res.url()}`);
      try {
        const text = await res.text();
        console.log(`   Response Body: ${text.substring(0, 300)}`);
      } catch (e) {}
    }
  });

  await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const cookieBtn = page.locator('button:has-text("Aceitar todos"), button:has-text("Aceitar")').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  await page.click('button#botao-login, a:has-text("Entrar"), .dropdown:has-text("Entrar")');
  await page.waitForTimeout(1500);

  await page.fill('input[name="email"]', 'santanacomercial2021@gmail.com');
  await page.fill('input[name="senha"]', '871935');

  console.log('Clicando em button#btn-entrar...');
  await page.click('button#btn-entrar');
  await page.waitForTimeout(4000);

  const modalTxt = await page.evaluate(() => {
    const modal = document.querySelector('.modal, div[role="dialog"]');
    return modal ? modal.innerText : 'Modal fechado/não localizado';
  });

  console.log('Texto do Modal pós-clique:\n', modalTxt);
  console.log('URL final:', page.url());

  await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'cicalfer_post_login_modal.png') });
  await browser.close();
})();
