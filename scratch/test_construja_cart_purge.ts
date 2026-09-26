import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function testConstrujaPurgeConfirm() {
  console.log('=== TESTANDO CLIQUE REMOVER E CONFIRMAR MODAL CONSTRUJÁ ===');
  const forn = await db.fornecedores.getById('a1684c4d-d896-4ba9-a591-cda455c5ffe2');
  const loginUser = (forn as any).emailLogin || (forn as any).login_salvo;
  const rawPass = (forn as any).rawSenhaCriptografada || (forn as any).senha_login;
  const pass = decryptAES256(rawPass);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 1. Login
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

  // Filial
  const optionCard = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial').first();
  if (await optionCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await optionCard.click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Confirmar seleção")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForTimeout(2000);
  }

  // 2. Abrir carrinho
  const cartBtn = page.locator('#botao-abrir-carrinho, button:has-text("Ver carrinho")').first();
  if (await cartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cartBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // 3. Purga interativa
  for (let loop = 0; loop < 10; loop++) {
    const removeBtn = page.locator('button[title="Remover item"], button[aria-label="Remover item"]').first();
    if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`[PURGE CONSTRUJÁ] Clicando em Remover item (${loop + 1})...`);
      await removeBtn.evaluate((b: any) => b.click());
      await page.waitForTimeout(1500);

      // Procurar botões de confirmação no modal
      const modalText = await page.evaluate(() => {
        const modal = document.querySelector('.modal, div[role="dialog"]') || document.body;
        return {
          text: modal.innerText.substring(0, 300),
          btns: Array.from(modal.querySelectorAll('button')).map(b => b.innerText.trim())
        };
      });
      console.log(`[MODAL TEXT]:`, modalText);

      const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir"), button:has-text("Remover")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(2000);
      }
    } else {
      console.log(`[PURGE CONSTRUJÁ] Nenhum botão de remoção visível na iteração ${loop + 1}.`);
      break;
    }
  }

  // 4. Inspect final do carrinho
  const textAfter = await page.evaluate(() => (document.querySelector('#compra-rapida-carrinho, .offcanvas') || document.body).innerText);
  console.log('[CONSTRUJÁ CARRINHO PÓS PURGA]:');
  console.log(textAfter.substring(0, 400));

  await browser.close();
}

testConstrujaPurgeConfirm().catch(err => console.error(err));
