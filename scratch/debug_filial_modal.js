const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('🔍 [DEBUG FILIAL] Iniciando inspeção visual de login e filial na Cicalfer...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://cicalfer.com.br/', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  // Abrir login
  const loginTrigger = page.locator('.dropdown:has-text("Entrar"), a:has-text("Entrar"), button#botao-login').first();
  if (await loginTrigger.isVisible()) {
    await loginTrigger.click();
    await page.waitForTimeout(2000);
  }

  // Preencher credenciais
  const emailInput = page.locator('input[name="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.fill('santanacomercial2021@gmail.com');
  await passInput.fill('871935');
  await page.screenshot({ path: path.join(process.cwd(), 'scratch', '01_login_filled.png') });

  // Clicar Entrar
  await page.locator('button#btn-entrar, button:has-text("Entrar")').first().click();
  await page.waitForTimeout(4000);

  await page.screenshot({ path: path.join(process.cwd(), 'scratch', '02_post_login.png') });
  console.log('Post-login URL:', page.url());

  const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
  console.log('Post-login Body Text snippet:', bodyText.substring(0, 1000));

  // Verificar elementos de modal ou filial na página
  const modals = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.modal, div[class*="modal"], div[class*="Modal"], div[class*="optionCard"]'));
    return els.map(e => ({
      className: e.className,
      innerText: e.innerText ? e.innerText.replace(/\n+/g, ' ').substring(0, 200) : ''
    }));
  });

  console.log('Modals/OptionCards detectados:', JSON.stringify(modals, null, 2));

  await browser.close();
})();
