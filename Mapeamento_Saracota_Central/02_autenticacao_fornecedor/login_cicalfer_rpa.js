/**
 * ETAPA 3: AUTENTICAÇÃO NO FORNECEDOR — LOGIN AUTOMÁTICO NO SITE EXTERNO (CICALFER)
 * 
 * Extraído de core/services/supplier-quote-engine/index.js
 * Executa o login automatizado no portal B2B da Cicalfer e seleciona a filial "ENTREGA".
 */

const path = require('path');

async function realizarLogin(page, config, credentials) {
  const sel = config.selectors;
  console.log(`[RPA LOGIN] Navegando para o site do fornecedor: ${config.url_site}`);
  
  try {
    await page.goto(config.url_site, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 1. Aceitar banner de Cookies se visível
    if (sel.cookie_accept) {
      const acceptCookie = page.locator(sel.cookie_accept).first();
      if (await acceptCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
        await acceptCookie.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // 2. Clicar no botão/gatilho de abrir modal de login
    const emailInput = page.locator(sel.email_input).first();
    const loginBtn = page.locator(sel.login_trigger).first();

    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[RPA LOGIN] Clicando no gatilho de login...');
      await loginBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // 3. Preencher formulário de login com credenciais fornecidas
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`[RPA LOGIN] Preenchendo dados de acesso (${credentials.user})...`);
      await emailInput.fill(credentials.user);
      await page.locator(sel.password_input).first().fill(credentials.pass);
      await page.waitForTimeout(1000);

      // Clicar em Entrar
      await page.locator(sel.login_submit).first().click({ force: true });
      await page.waitForTimeout(3000);

      // Verificar erro de login rejeitado pelo fornecedor
      const hasErrorMsg = await page.evaluate(() => {
        const txt = document.body ? document.body.innerText : '';
        return txt.includes('Credenciais Inválidas') || txt.includes('inválid') || txt.includes('incorret');
      });

      if (hasErrorMsg) {
        throw new Error(`[ERRO LOGIN CICALFER] Credenciais Inválidas no site do fornecedor para usuário: ${credentials.user}`);
      }
      console.log(`[RPA LOGIN SUCESSO] Login efetuado para: ${credentials.user}`);
    } else {
      console.log('[RPA LOGIN] Sessão reidratada / já autenticado.');
    }

    // 4. Seleção de Filial B2B (Filtra a filial que contenha a palavra "ENTREGA")
    if (sel.filial_cards) {
      const optionCards = page.locator(sel.filial_cards);
      if (await optionCards.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`[RPA FILIAL] Selecionando filial "${config.default_filial_keyword}"...`);
        
        const cardCount = await optionCards.count();
        let selectedIndex = -1;
        for (let i = 0; i < cardCount; i++) {
          const text = await optionCards.nth(i).evaluate(el => el.innerText.replace(/\n+/g, ' ')).catch(() => '');
          if (text.includes(config.default_filial_keyword) && !text.includes('RETIRA')) {
            selectedIndex = i;
            break;
          }
        }

        if (selectedIndex !== -1) {
          await optionCards.nth(selectedIndex).click({ force: true });
          await page.waitForTimeout(1000);
          await page.locator(sel.filial_confirm).first().click({ force: true });
          await page.waitForTimeout(2000);
          console.log(`[RPA FILIAL] Filial confirmada com sucesso: "${config.default_filial_keyword}".`);
        }

        // Recarregar para reidratar cookies B2B da filial selecionada
        await page.reload({ waitUntil: 'commit' });
        await page.waitForTimeout(3000);

        // Fechar modal de tutorial tour pós-login se visível
        const btnEntendiLogin = page.locator('button.shepherd-button, button:has-text("Entendi")').first();
        if (await btnEntendiLogin.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btnEntendiLogin.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1000);
        }
      }
    }
  } catch (err) {
    console.error('Falha na automação de login Cicalfer:', err);
    throw err;
  }
}

module.exports = { realizarLogin };
