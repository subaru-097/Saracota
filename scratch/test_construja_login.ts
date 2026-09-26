import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const LOGIN_EMAIL = process.env.CONSTRUJA_EMAIL || 'comercialsantana@gmail.com';
const LOGIN_PASS = process.env.CONSTRUJA_PASSWORD || '53597';

async function testConstrujaLogin() {
  console.log('================================================================================');
  console.log('🧪 TESTE DE AUTENTICAÇÃO E CAPTURA DE PREÇOS REAIS - CONSTRUJÁ');
  console.log('================================================================================\n');

  const screenshotsDir = path.join(process.cwd(), 'scratch', 'screenshots_construja_login');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (e) {
    browser = await chromium.launch({ headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await context.newPage();

  try {
    console.log('1️⃣ Acessando https://www.construja.com.br ...');
    await page.goto('https://www.construja.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    console.log('2️⃣ Abrindo modal de Login...');
    const loginLink = page.locator('a[href*="/login"], button:has-text("Entre"), span:has-text("Entre"), a:has-text("Entre")').first();
    if (await loginLink.isVisible().catch(() => false)) {
      await loginLink.click();
      await page.waitForTimeout(2000);
    }

    const modal = page.locator('.modal-login, div[role="dialog"]').first();
    const isModalVisible = await modal.isVisible().catch(() => false);
    console.log(`   -> Modal de login visível: ${isModalVisible}`);

    console.log('3️⃣ Preenchendo campos dentro do modal...');
    const container = isModalVisible ? modal : page.locator('body');

    const emailInput = container.locator('input[type="email"], input[name*="email"], input[name*="login"], input[placeholder*="email" i], input[placeholder*="cpf" i]').first();
    const passInput = container.locator('input[type="password"], input[name*="senha"], input[name*="pass"], input[placeholder*="senha" i]').first();

    await emailInput.fill(LOGIN_EMAIL);
    console.log(`   -> E-mail preenchido: ${LOGIN_EMAIL}`);
    await passInput.fill(LOGIN_PASS);
    console.log('   -> Senha preenchida.');

    await page.screenshot({ path: path.join(screenshotsDir, '03_form_filled.png') });

    console.log('4️⃣ Submetendo formulário dentro do modal...');
    const submitBtn = container.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar"), button:has-text("Login")').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    } else {
      await passInput.press('Enter');
    }

    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(screenshotsDir, '04_after_login_submit.png') });

    const currentUrl = page.url();
    console.log(`   -> URL após login: ${currentUrl}`);

    // Verificar se modal fechou e estado do usuário
    const userState = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const modalOpen = Boolean(document.querySelector('.modal-login.show, .modal.show'));
      const hasLoginText = text.toLowerCase().includes('faça login');
      const userMention = text.includes('Santana') || text.includes('Olá') || text.includes('Minha Conta') || text.includes('Sair');
      return { modalOpen, hasLoginText, userMention };
    });
    console.log('   -> Estado do usuário:', userState);

    console.log('\n5️⃣ Navegando para a categoria "ABRASIVOS" para extrair preços com sessão ativa...');
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Clicar em ABRASIVOS
    await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.font-size-14.fw-medium.text-uppercase'));
      const match = spans.find(s => s.textContent?.trim().toUpperCase() === 'ABRASIVOS');
      if (match) {
        let parent: HTMLElement | null = match as HTMLElement;
        while (parent && parent.tagName !== 'BUTTON' && parent.tagName !== 'A') {
          parent = parent.parentElement;
        }
        if (parent) parent.click();
      }
    });

    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotsDir, '05_abrasivos_autenticado.png') });

    // Extrair os 5 primeiros produtos e seus elementos de preço
    const sampleProducts = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]')).slice(0, 5);
      return containers.map(c => {
        const link = c.querySelector('a[href*="/produto/"]');
        const titleEl = c.querySelector('[class*="CardProduto_tituloCardProduto"]');
        const href = link?.getAttribute('href') || '';
        const rawTitle = titleEl?.textContent?.trim() || '';

        const priceEl = c.querySelector('div[class*="CardProduto_precoCardProduto"], [class*="preco"], [class*="valorUnitario"], [class*="valorUnitarioDestaque"]');
        const priceHTML = priceEl ? priceEl.outerHTML : 'NOT_FOUND';
        const priceText = priceEl ? priceEl.textContent?.trim() : '';

        const precoNum = parseFloat((priceText || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;

        return {
          title: rawTitle,
          priceHTML,
          priceText,
          precoNum,
          url: href
        };
      });
    });

    console.log('\n================================================================================');
    console.log('📊 RESULTADO DA INSPEÇÃO DOS 5 PRODUTOS COM LOGIN');
    console.log('================================================================================');
    sampleProducts.forEach((p, idx) => {
      console.log(`\n--- PRODUTO #${idx + 1} ---`);
      console.log(`Nome: ${p.title}`);
      console.log(`Preço no site (texto): "${p.priceText}"`);
      console.log(`HTML Bruto: ${p.priceHTML}`);
      console.log(`Valor Numérico Salvo: R$ ${p.precoNum.toFixed(2)}`);
    });

  } catch (err: any) {
    console.error('❌ Erro durante o teste de login:', err);
  } finally {
    await context.close();
    await browser.close();
  }
}

testConstrujaLogin().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
