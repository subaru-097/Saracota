/**
 * ETAPA 2B: FLUXO OBRIGATÓRIO DE AUTENTICAÇÃO RPA DA CONSTRUJÁ
 * 
 * Sequência estrita de execução:
 * 1. Abertura de Navegador e Acesso à URL Inicial B2B (https://www.construja.com.br/produtos)
 * 2. Detecção e Aceite do Banner de Cookies LGPD
 * 3. Disparo do Gatilho de Login (#botao-login)
 * 4. Preenchimento dos Campos E-mail e Senha no Modal
 * 5. Submissão do Formulário (button#btn-entrar)
 * 6. Confirmação da Sessão Autenticada
 */

async function realizarLoginConstruja(page, config, credentials) {
  const sel = config.selectors || {};
  const baseUrl = config.url_site || config.base_url || 'https://www.construja.com.br/produtos';

  console.log(`[RPA CONSTRUJÁ - PASSO 1] Navegando para URL B2B: ${baseUrl}...`);
  await page.goto(baseUrl, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 1. PASSO OBRIGATÓRIO: ACEITAR COOKIES (evita bloqueio transparente na interface)
  const cookieSel = sel.cookie_accept || 'button:has-text("Aceitar"), button:has-text("Concordar"), button:has-text("Entendi")';
  const cookieBtn = page.locator(cookieSel).first();
  if (await cookieBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    console.log('[RPA CONSTRUJÁ - PASSO 2] Banner de cookies detectado. Aceitando...');
    await cookieBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // 2. PASSO OBRIGATÓRIO: ABRIR MODAL DE LOGIN
  const emailSel = sel.email_input || 'input[name="email"].form-control';
  const triggerSel = sel.login_trigger || '#botao-login';

  const emailInput = page.locator(emailSel).first();
  const isEmailVisible = await emailInput.isVisible({ timeout: 2000 }).catch(() => false);

  if (!isEmailVisible) {
    const loginTrigger = page.locator(triggerSel).first();
    if (await loginTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[RPA CONSTRUJÁ - PASSO 3] Clicando no gatilho de login (#botao-login)...');
      await loginTrigger.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  // 3. PASSO OBRIGATÓRIO: PREENCHER E-MAIL E SENHA
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log(`[RPA CONSTRUJÁ - PASSO 4] Preenchendo e-mail (${credentials.user}) e senha...`);
    await emailInput.fill(credentials.user);
    const passSel = sel.password_input || 'input#senha[name="senha"]';
    await page.locator(passSel).first().fill(credentials.pass);
    await page.waitForTimeout(1000);

    // 4. PASSO OBRIGATÓRIO: SUBMETER FORMULÁRIO DE LOGIN
    const submitSel = sel.login_submit || 'button#btn-entrar';
    console.log('[RPA CONSTRUJÁ - PASSO 5] Submetendo formulário de login (button#btn-entrar)...');
    await page.locator(submitSel).first().click({ force: true });
    await page.waitForTimeout(4000);

    // 5. CONFIRMAÇÃO DE SESSÃO AUTENTICADA
    const isLogged = await page.evaluate(() => {
      const txt = document.body ? document.body.innerText : '';
      return !txt.includes('FAÇA LOGIN') || txt.includes('Sair') || txt.includes('Minha Conta');
    });

    if (isLogged) {
      console.log('[RPA CONSTRUJÁ - PASSO 6] Autenticação confirmada com sucesso!');
    } else {
      console.warn('[RPA CONSTRUJÁ - PASSO 6] Alerta: Verificação de login pendente ou sessão reidratada.');
    }
  } else {
    console.log('[RPA CONSTRUJÁ] Sessão B2B já estava ativa/reidratada no navegador.');
  }
}

module.exports = { realizarLoginConstruja };
