import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

(async () => {
  console.log('=== TESTANDO CANDIDATOS DE SENHA NO PORTAL DA CICALFER ===');

  const candidates = ['871935', '53597', 'santanacomercial', 'santanacomercial2021'];
  const user = 'santanacomercial2021@gmail.com';

  const browser = await chromium.launch({ headless: true });

  for (const pass of candidates) {
    console.log(`\n--- Testando e-mail: "${user}" | Senha: "${pass}" ---`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const cookieBtn = page.locator('button:has-text("Aceitar todos"), button:has-text("Aceitar")').first();
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click();
      await page.waitForTimeout(1000);
    }

    const loginTrigger = page.locator('button#botao-login, a:has-text("Entrar"), .dropdown:has-text("Entrar")').first();
    await loginTrigger.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);

    await page.fill('input[name="email"]', user);
    await page.fill('input[name="senha"]', pass);

    // Clique exato no botão do modal
    await page.click('.modal button[type="submit"], button#btn-entrar');
    await page.waitForTimeout(4000);

    const postUrl = page.url();
    const hasErrorMsg = await page.evaluate(() => {
      const txt = document.body ? document.body.innerText : '';
      return txt.includes('Credenciais Inválidas') || txt.includes('inválid') || txt.includes('incorret') || txt.includes('E-mail ou Senha');
    });

    const isLogged = await page.evaluate(() => {
      const txt = document.body ? document.body.innerText : '';
      return txt.includes('Minha Conta') || txt.includes('Sair') || txt.includes('Olá,') || txt.includes('BEM-VINDO') || txt.includes('Filial');
    });

    console.log(`URL pós-login: "${postUrl}"`);
    console.log(`Tem erro de credencial?: ${hasErrorMsg}`);
    console.log(`Detectado estado logado?: ${isLogged}`);

    await page.screenshot({ path: path.join(process.cwd(), 'historicos', '2026-09-15', `cicalfer_login_test_${pass}.png`) });
    await page.close();
  }

  await browser.close();
})();
