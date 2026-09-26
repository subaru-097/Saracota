import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function diagnoseStepByStep() {
  console.log('🔬 [TESTE 18 DIAGNÓSTICO] Executando verificação síncrona passo a passo no portal Construjá...');

  const baseDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste18_construja_correcao');
  const construjaDir = path.join(baseDir, 'construja');
  if (!fs.existsSync(construjaDir)) fs.mkdirSync(construjaDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // ------------------------------------------------------------------
    // STEP A: COOKIES & CARREGAMENTO DA PÁGINA
    // ------------------------------------------------------------------
    console.log('\n--- PASSO A: Navegando para https://www.construja.com.br/produtos ---');
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verificar se existe banner/modal de cookies
    const cookieSel = 'button:has-text("Aceitar"), button:has-text("Concordar"), button:has-text("Entendi"), #lgpd-aceitar, .lgpd-accept';
    const cookieBtn = page.locator(cookieSel).first();
    const isCookieVisible = await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`🔎 Banner de Cookie/LGPD visível? ${isCookieVisible}`);

    if (isCookieVisible) {
      await page.screenshot({ path: path.join(construjaDir, '01_cookie_banner_detectado.png'), fullPage: false });
      console.log('📸 01_cookie_banner_detectado.png salvo.');
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
      console.log('✅ Banner de cookies aceito.');
    } else {
      await page.screenshot({ path: path.join(construjaDir, '01_cookie_banner_detectado.png'), fullPage: false });
      console.log('📸 01_cookie_banner_detectado.png salvo (Sem modal bloqueante).');
    }

    // ------------------------------------------------------------------
    // STEP B: GATILHO DE LOGIN (#botao-login)
    // ------------------------------------------------------------------
    console.log('\n--- PASSO B: Localizando e clicando no gatilho de login (#botao-login) ---');
    const triggerSel = '#botao-login, button:has-text("FAÇA LOGIN"), .componentes-button_login, a:has-text("Entrar")';
    const loginTrigger = page.locator(triggerSel).first();
    const isTriggerVisible = await loginTrigger.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`🔎 Gatilho de login visível? ${isTriggerVisible}`);

    if (isTriggerVisible) {
      await loginTrigger.click({ force: true });
      await page.waitForTimeout(2000);
    } else {
      console.warn('⚠️ Gatilho de login não estava visível imediatamente.');
    }

    // ------------------------------------------------------------------
    // STEP C & D: PREENCHIMENTO DE E-MAIL E SENHA
    // ------------------------------------------------------------------
    console.log('\n--- PASSO C & D: Verificando campos de e-mail e senha ---');
    const emailSel = 'input[name="email"].form-control, input[name="email"]';
    const passSel = 'input#senha[name="senha"], input[type="password"]';

    const emailInput = page.locator(emailSel).first();
    const passInput = page.locator(passSel).first();

    const isEmailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`🔎 Campo de E-mail visível? ${isEmailVisible}`);

    if (!isEmailVisible) {
      console.error('❌ ERRO CRÍTICO: O campo de e-mail não apareceu após o clique no gatilho de login!');
      await page.screenshot({ path: path.join(construjaDir, 'ERRO_02_modal_login_nao_abriu.png'), fullPage: false });
      return;
    }

    await emailInput.fill('comercialsantana@gmail.com');
    await passInput.fill('53597');
    await page.waitForTimeout(1000);

    // PRINT 02: Modal de login preenchido
    await page.screenshot({ path: path.join(construjaDir, '02_modal_login_preenchido.png'), fullPage: false });
    console.log('📸 02_modal_login_preenchido.png salvo.');

    // ------------------------------------------------------------------
    // STEP E: CONFIRMAÇÃO DE LOGIN
    // ------------------------------------------------------------------
    console.log('\n--- PASSO E: Clicando em entrar e confirmando login ---');
    const submitSel = 'button#btn-entrar, form button#btn-entrar';
    await page.locator(submitSel).first().click({ force: true });
    await page.waitForTimeout(4000);

    // PRINT 03: Pós login sucesso
    await page.screenshot({ path: path.join(construjaDir, '03_login_confirmado_sucesso.png'), fullPage: false });
    console.log('📸 03_login_confirmado_sucesso.png salvo.');

    const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
    const isLogged = bodyText.includes('Minha Conta') || bodyText.includes('Sair') || bodyText.includes('comercialsantana') || !bodyText.includes('FAÇA LOGIN');
    console.log(`🎉 Login confirmado com sucesso? ${isLogged}`);

  } catch (err) {
    console.error('❌ Exceção no diagnóstico:', err);
  } finally {
    await browser.close();
  }
}

diagnoseStepByStep().catch(console.error);
