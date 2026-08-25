const { dismissCookieBanner } = require('../../lib/services/automacao/cookieBanner');

async function login(page, credenciais) {
  // 1. Dispensa de banner de cookies/LGPD antes de qualquer tentativa de login
  await dismissCookieBanner(page);

  // 2. Clique no gatilho de login e preenchimento
  const triggerBtn = page.locator('text=Entrar..., button:has-text("Entre ou cadastre-se"), #botao-login').first();
  if (await triggerBtn.isVisible().catch(() => false)) {
    await triggerBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  await page.fill('input[name="email"], input[type="email"]', credenciais.login);
  await page.fill('input[type="password"], input[name="senha"], input#senha', credenciais.senha);
  await page.click('button[type="submit"], button:has-text("Entrar"), div:text-is("Entrar")');
  await page.waitForTimeout(2000);
}

module.exports = { login };
