const { chromium } = require('playwright');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

(async () => {
  console.log('=== INSPEÇÃO DO BOTÃO DO CARRINHO NA CICALFER ===');
  const forn = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  const user = forn.email || 'santanacomercial2021@gmail.com';
  const pass = decryptAES256(forn.senhaCriptografada || forn.rawSenhaCriptografada);

  console.log('User:', user, 'Pass length:', pass?.length);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login
  await page.goto('https://cicalfer.com.br/');
  await page.waitForTimeout(2000);
  await page.click('button#botao-login, a:has-text("Entrar")').catch(() => {});
  await page.waitForTimeout(1000);
  await page.fill('input[name="email"]', user);
  await page.fill('input[name="senha"]', pass);
  await page.click('button#btn-entrar, button[type="submit"]');
  await page.waitForTimeout(3000);

  // Ir para busca e adicionar item
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=Ducha%20Lorenzetti');
  await page.waitForTimeout(3000);

  const addBtn = page.locator('button:has-text("Comprar"), button:has-text("Adicionar")').first();
  await addBtn.click();
  await page.waitForTimeout(3000);

  console.log('URL atual:', page.url());

  // Inspecionar seletores de carrinho
  const sel1 = 'button#botao-abrir-carrinho';
  const sel2 = 'button:has-text("Ver carrinho")';
  const sel3 = 'a[href*="carrinho"]';
  const sel4 = 'button.componentes-ver_carrinho-color';
  const sel5 = '[aria-label*="carrinho"], [aria-label*="Carrinho"]';

  console.log('sel1 count:', await page.locator(sel1).count(), 'visible:', await page.locator(sel1).first().isVisible().catch(() => false));
  console.log('sel2 count:', await page.locator(sel2).count(), 'visible:', await page.locator(sel2).first().isVisible().catch(() => false));
  console.log('sel3 count:', await page.locator(sel3).count(), 'visible:', await page.locator(sel3).first().isVisible().catch(() => false));
  console.log('sel4 count:', await page.locator(sel4).count(), 'visible:', await page.locator(sel4).first().isVisible().catch(() => false));
  console.log('sel5 count:', await page.locator(sel5).count(), 'visible:', await page.locator(sel5).first().isVisible().catch(() => false));

  // Print all buttons/links on page
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, div, span')).map(el => ({
      tag: el.tagName,
      id: el.id,
      class: el.className,
      text: el.innerText.trim(),
      href: el.getAttribute('href')
    })).filter(b => b.text.toLowerCase().includes('carrinho') || (b.id && b.id.includes('carrinho')) || (b.href && b.href.includes('carrinho')));
  });

  console.log('Elementos de carrinho no DOM:', JSON.stringify(buttons.slice(0, 15), null, 2));

  // Test clicking button#botao-abrir-carrinho
  console.log('Tentando clicar em button#botao-abrir-carrinho...');
  await page.click('button#botao-abrir-carrinho').catch(e => console.log('Erro ao clicar sel1:', e.message));
  await page.waitForTimeout(3000);
  console.log('URL pós clique:', page.url());

  await browser.close();
})();
