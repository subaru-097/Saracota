const { chromium } = require('playwright');

async function investigateForm() {
  console.log('🔬 INVESTIGANDO COMPORTAMENTO DO FORMULÁRIO DE LOGIN DE CONSTRUJÁ...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Escutar TODOS os requests
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('api.construja.com.br') || url.includes('auth') || url.includes('login') || url.includes('v1')) {
      console.log(`🚀 [REQ ${req.method()}] ${url} | PostData: ${req.postData() || 'none'}`);
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('api.construja.com.br') || url.includes('auth') || url.includes('login') || url.includes('v1')) {
      console.log(`📥 [RES ${res.status()}] ${url} | Body: ${(await res.text().catch(() => '')).substring(0, 200)}`);
    }
  });

  try {
    await page.goto('https://www.construja.com.br/', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    const cookieBtn = page.locator('#botao-aceitar-todos').first();
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click();
      await page.waitForTimeout(1000);
    }

    const loginBtn = page.locator('button#botao-login').first();
    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(2000);
    }

    // Inspecionar DOM do formulário de login
    const formInfo = await page.evaluate(() => {
      const emailEl = document.querySelector('input[name="email"]');
      const senhaEl = document.querySelector('input#senha');
      const submitEl = document.querySelector('button#btn-entrar');
      const formEl = submitEl ? submitEl.closest('form') : null;

      return {
        emailFound: Boolean(emailEl),
        emailValue: emailEl ? emailEl.value : '',
        senhaFound: Boolean(senhaEl),
        senhaValue: senhaEl ? senhaEl.value : '',
        submitFound: Boolean(submitEl),
        submitType: submitEl ? submitEl.getAttribute('type') : '',
        submitDisabled: submitEl ? submitEl.disabled : false,
        hasForm: Boolean(formEl),
        formAction: formEl ? formEl.getAttribute('action') : '',
        formOnSubmit: formEl ? Boolean(formEl.onsubmit) : false,
      };
    });

    console.log('DOM Form Info:', JSON.stringify(formInfo, null, 2));

    // Testar 1: Preencher via Playwright type (caractere por caractere)
    console.log('\n--- TESTE 1: Digitação via page.type() ---');
    const emailInp = page.locator('input[name="email"]').first();
    const passInp = page.locator('input#senha').first();

    await emailInp.focus();
    await emailInp.pressSequentially('comercialsantana2021@gmail.com', { delay: 30 });
    
    await passInp.focus();
    await passInp.pressSequentially('871935', { delay: 30 });
    await page.waitForTimeout(1000);

    const formValuesAfterType = await page.evaluate(() => {
      const e = document.querySelector('input[name="email"]');
      const s = document.querySelector('input#senha');
      return { email: e ? e.value : '', senha: s ? s.value : '' };
    });
    console.log('Valores nos inputs após type():', formValuesAfterType);

    // Clicar em Entrar
    console.log('Clicando em button#btn-entrar com click natural...');
    const btnSubmit = page.locator('button#btn-entrar').first();
    await btnSubmit.click();

    await page.waitForTimeout(4000);

    // Testar 2: Se ainda não enviou, testar submit direto do formulário ou Enter
    const modalAindaVisivel = await page.locator('button#btn-entrar').isVisible().catch(() => false);
    console.log('Modal ainda visível após clique 1?:', modalAindaVisivel);

    if (modalAindaVisivel) {
      console.log('\n--- TESTE 2: Pressionando Enter no campo de senha ---');
      await passInp.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);

      const modalVisivel2 = await page.locator('button#btn-entrar').isVisible().catch(() => false);
      console.log('Modal ainda visível após Enter?:', modalVisivel2);
    }

  } catch (err) {
    console.error('Erro na investigação:', err);
  } finally {
    await browser.close();
  }
}

investigateForm();
