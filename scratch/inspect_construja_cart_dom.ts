import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function inspectConstrujaCartDOM() {
  console.log('=== INSPECCIONANDO DOM DO CARRINHO DA CONSTRUJÁ ===');
  const forn = await db.fornecedores.getById('a1684c4d-d896-4ba9-a591-cda455c5ffe2');
  const loginUser = (forn as any).emailLogin || (forn as any).login_salvo;
  const rawPass = (forn as any).rawSenhaCriptografada || (forn as any).senha_login;
  const pass = decryptAES256(rawPass);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator('button:has-text("Aceitar todos"), button:has-text("Aceitar")').first();
  if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  const loginTrigger = page.locator('#botao-login, button:has-text("FAÇA LOGIN"), a:has-text("Entrar")').first();
  if (await loginTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(2000);
  }

  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(loginUser);
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill(pass);
    await page.waitForTimeout(500);
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);
  }

  const optionCard = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial').first();
  if (await optionCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await optionCard.click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Confirmar seleção")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForTimeout(2000);
  }

  const cartBtn = page.locator('#botao-abrir-carrinho, button:has-text("Ver carrinho")').first();
  if (await cartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cartBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  const cartInfo = await page.evaluate(() => {
    const drawer = document.querySelector('#compra-rapida-carrinho, .offcanvas-end, div[class*="carrinho"], div[class*="Cart"]') || document.body;
    const buttons = Array.from(drawer.querySelectorAll('button, a, svg, i')).map((el, i) => {
      const html = el.outerHTML;
      const text = el.textContent?.trim();
      const title = el.getAttribute('title') || el.getAttribute('aria-label') || '';
      return { index: i, tag: el.tagName, text, title, html: html.substring(0, 150) };
    });
    return {
      drawerHtml: drawer.outerHTML.substring(0, 2000),
      buttonsCount: buttons.length,
      buttons: buttons.filter(b => b.title || b.text || b.html.includes('svg') || b.html.includes('trash') || b.html.includes('lixeira'))
    };
  });

  console.log('CART INFO:', JSON.stringify(cartInfo, null, 2));

  await browser.close();
}

inspectConstrujaCartDOM().catch(console.error);
