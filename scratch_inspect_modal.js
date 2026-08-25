const { chromium } = require('playwright');

async function inspectModal() {
  console.log('--- INICIANDO INSPEÇÃO DE MODAL DE LOGIN NO CONSTRUJÁ ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Clicar no botão "FAÇA LOGIN OU CADASTRE-SE PARA VER OS PREÇOS"
    const loginButton = await page.$('.componentes-button_login, button:has-text("FAÇA LOGIN"), a[href*="login"]');
    if (loginButton) {
      console.log('Botão de abrir login/modal localizado. Clicando...');
      await loginButton.click();
      await page.waitForTimeout(3000);

      // Inspecionar todos os inputs e botões de submit visíveis no modal
      const modalElements = await page.$$eval('input, button', (els) =>
        els
          .filter((e) => e.offsetWidth > 0 && e.offsetHeight > 0)
          .map((e) => ({
            tag: e.tagName,
            type: e.getAttribute('type'),
            id: e.id,
            name: e.getAttribute('name'),
            class: e.className,
            placeholder: e.getAttribute('placeholder'),
            text: e.innerText?.trim(),
          }))
      );

      console.log('--- ELEMENTOS VISÍVEIS NO MODAL DE LOGIN ---');
      console.log(JSON.stringify(modalElements, null, 2));
    } else {
      console.log('Botão de abrir modal não encontrado.');
    }
  } catch (err) {
    console.error('Erro ao inspecionar modal:', err);
  } finally {
    await browser.close();
  }
}

inspectModal();
