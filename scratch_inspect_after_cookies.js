const { chromium } = require('playwright');

async function inspectAfterCookies() {
  console.log('--- TESTANDO FECHAMENTO DE COOKIES E LOGIN NO CONSTRUJÁ ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 1. Fechar o modal de cookies if present
    const acceptCookiesBtn = await page.$('#botao-aceitar-todos, button:has-text("Aceitar todos")');
    if (acceptCookiesBtn) {
      console.log('Modal de cookies detectado. Clicando em "Aceitar todos"...');
      await acceptCookiesBtn.click();
      await page.waitForTimeout(1500);
    }

    // 2. Procurar o botão "FAÇA LOGIN OU CADASTRE-SE PARA VER OS PREÇOS" ou botão de login no topo
    const loginTrigger = await page.$('.componentes-button_login, button:has-text("FAÇA LOGIN"), a[href*="login"]');
    if (loginTrigger) {
      console.log('Botão de login/entrar encontrado na página. Clicando...');
      await loginTrigger.click();
      await page.waitForTimeout(3000);
    }

    // 3. Procurar todos os inputs visíveis
    const inputs = await page.$$eval('input', (els) =>
      els.map((e) => ({
        tag: e.tagName,
        type: e.getAttribute('type'),
        id: e.id,
        name: e.getAttribute('name'),
        class: e.className,
        placeholder: e.getAttribute('placeholder'),
        isVisible: e.offsetWidth > 0 && e.offsetHeight > 0,
      }))
    );

    console.log('--- INPUTS APÓS ABRIR LOGIN ---');
    console.log(JSON.stringify(inputs, null, 2));

    // 4. Inspecionar modal se houver
    const modalContent = await page.evaluate(() => {
      const modals = Array.from(document.querySelectorAll('.modal, [role="dialog"]'));
      return modals.map(m => m.outerHTML.slice(0, 1000));
    });
    console.log('--- MODAIS ATIVOS NA PÁGINA ---');
    console.log(JSON.stringify(modalContent, null, 2));

  } catch (err) {
    console.error('Erro na inspeção:', err);
  } finally {
    await browser.close();
  }
}

inspectAfterCookies();
