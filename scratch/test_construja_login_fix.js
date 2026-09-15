require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { chromium } = require('playwright');
const fs = require('fs');

function decryptAES256(encryptedData) {
  if (!encryptedData) return '';
  try {
    const crypto = require('crypto');
    const secret = process.env.ENCRYPTION_KEY || process.env.VAULT_SECRET || 'saracota_vault_master_key_aes256_32bytes_secret';
    const keyBuf = crypto.createHash('sha256').update(secret).digest();
    const parts = encryptedData.split(':');
    if (parts.length !== 2) return encryptedData;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return '871935';
  }
}

async function testLoginFix() {
  console.log('🧪 TESTANDO LOGIN CONSTRUJÁ COM DISPATCH DE EVENTOS REACT E ESCUTA DE REDE...');

  const loginUser = 'comercialsantana2021@gmail.com';
  const rawPass = 'e733d3f70df4837558df2610bfaf7801:e37dca8ac74358f299415e899868e65f';
  const loginPass = decryptAES256(rawPass) || '871935';

  console.log(`🔑 Login User: "${loginUser}" | Senha: [${loginPass.length} chars]`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Monitar chamadas e respostas de API HTTP
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('auth') || url.includes('login') || url.includes('v1') || url.includes('token') || url.includes('cliente') || url.includes('session')) {
      const status = res.status();
      let bodyText = '';
      try {
        bodyText = await res.text();
      } catch (e) {}
      console.log(`🌐 [HTTP ${status}] ${url.substring(0, 100)} ➔ Response: ${bodyText.substring(0, 300)}`);
    }
  });

  try {
    console.log('1. Navegando para https://www.construja.com.br/...');
    await page.goto('https://www.construja.com.br/', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 2. Aceitar cookies com #botao-aceitar-todos
    const cookieBtn = page.locator('#botao-aceitar-todos, button:has-text("Aceitar todos")').first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('2. Clicando em #botao-aceitar-todos...');
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // 3. Abrir modal de login
    const loginBtn = page.locator('button#botao-login, button[label="Entrar"]').first();
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('3. Clicando em button#botao-login...');
      await loginBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // 4. Preencher e-mail e senha com dispatch de eventos
    const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
    const passInput = page.locator('input#senha[name="senha"].form-control, input#senha').first();

    if (await emailInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('4. Preenchendo formulário e disparando eventos DOM...');
      await emailInput.focus();
      await emailInput.fill(loginUser);
      await page.evaluate((val) => {
        const el = document.querySelector('input[name="email"]');
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, loginUser);

      await passInput.focus();
      await passInput.fill(loginPass);
      await page.evaluate((val) => {
        const el = document.querySelector('input#senha, input[name="senha"]');
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, loginPass);

      await page.waitForTimeout(1000);

      // 5. Clicar em Entrar
      const submitBtn = page.locator('button#btn-entrar').first();
      console.log('5. Clicando em button#btn-entrar...');
      await submitBtn.click({ force: true });

      await page.waitForTimeout(5000);

      // Verificar se o modal fechou ou se apareceu texto de erro/sucesso
      const modalVisivel = await page.locator('.modal-content, #btn-entrar').first().isVisible().catch(() => false);
      console.log('Modal de login ainda visível?:', modalVisivel);

      // Capturar texto da página
      const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
      const userLoggedIn = bodyText.includes('Santana') || bodyText.includes('comercial') || bodyText.includes('Minha Conta') || bodyText.includes('Sair');
      console.log('Usuário logado detectado no texto da página?:', userLoggedIn);

      // Testar ir para produtos
      console.log('6. Indo para /produtos...');
      await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit', timeout: 30000 });
      await page.waitForTimeout(3000);

      console.log('URL em /produtos:', page.url());

      // Testar ir para /carrinho
      console.log('7. Indo para /carrinho...');
      await page.goto('https://www.construja.com.br/carrinho', { waitUntil: 'commit', timeout: 30000 });
      await page.waitForTimeout(3000);

      console.log('URL em /carrinho:', page.url());
    } else {
      console.error('Email input não visível');
    }
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await browser.close();
  }
}

testLoginFix();
