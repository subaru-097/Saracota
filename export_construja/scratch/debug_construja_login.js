const { chromium } = require('playwright');

(async () => {
  console.log('🔍 [DEBUG CONSTRUJÁ] Inspecionando página de login do Construjá...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  // Clicar no botão de login
  const btnLogin = page.locator('#botao-login, button:has-text("Entrar"), a:has-text("Entrar")').first();
  if (await btnLogin.isVisible()) {
    console.log('Clicando em #botao-login...');
    await btnLogin.click({ force: true });
    await page.waitForTimeout(4000);
  }

  console.log('URL após clicar login:', page.url());

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(inp => ({
      type: inp.type,
      name: inp.name,
      id: inp.id,
      className: inp.className,
      placeholder: inp.placeholder,
      isVisible: inp.offsetWidth > 0 && inp.offsetHeight > 0
    }));
  });

  console.log('Inputs encontrados:', JSON.stringify(inputs, null, 2));

  await browser.close();
})();
