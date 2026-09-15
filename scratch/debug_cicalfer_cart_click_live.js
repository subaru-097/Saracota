const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

(async () => {
  console.log('=== TESTE DE CLIQUE NO BOTÃO DO CARRINHO DA CICALFER (LIVE) ===');
  const outputDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste15_correcao_definitiva', 'cicalfer');
  fs.mkdirSync(outputDir, { recursive: true });

  const forn = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  const user = forn.email || 'santanacomercial2021@gmail.com';
  const pass = decryptAES256(forn.senhaCriptografada || forn.rawSenhaCriptografada);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // 1. Home
  console.log('1. Abrindo home...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 2. Cookie
  const cookieBtn = page.locator('button:has-text("Aceitar todos"), button:has-text("Aceitar")').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // 3. Login
  console.log('2. Efetuando login...');
  await page.click('button#botao-login, a:has-text("Entrar")').catch(() => {});
  await page.waitForTimeout(1500);
  await page.fill('input[name="email"]', user);
  await page.fill('input[name="senha"]', pass);
  await page.click('.modal button[type="submit"], button#btn-entrar');
  await page.waitForTimeout(4000);

  console.log('URL pós login:', page.url());
  await page.screenshot({ path: path.join(outputDir, '01_login_sucesso.png') });

  // 4. Filial se houver
  const filialCard = page.locator('button.ModalClienteFilial_optionCard__vj1Sf').first();
  if (await filialCard.isVisible().catch(() => false)) {
    console.log('Selecionando filial...');
    await filialCard.click();
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Confirmar seleção")').catch(() => {});
    await page.waitForTimeout(3000);
  }

  // 5. Ir para produtos e adicionar item
  console.log('3. Buscando produto Ducha Lorenzetti...');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=Ducha%20Lorenzetti', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outputDir, '02_busca_produto.png') });

  console.log('4. Clicando em Adicionar/Comprar...');
  const addBtn = page.locator('button:has-text("Comprar"), button:has-text("Adicionar")').first();
  await addBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outputDir, '03_item_adicionado.png') });

  // 6. Inspecionar botão de carrinho
  const cartBtnSel = 'button#botao-abrir-carrinho, button:has-text("Ver carrinho"), a[href*="carrinho"]';
  const cartBtn = page.locator(cartBtnSel).first();

  console.log('Botão de carrinho - count:', await page.locator('button#botao-abrir-carrinho').count(), 'isVisible:', await page.locator('button#botao-abrir-carrinho').first().isVisible().catch(() => false));
  console.log('Botão com text "Ver carrinho" - count:', await page.locator('button:has-text("Ver carrinho")').count(), 'isVisible:', await page.locator('button:has-text("Ver carrinho")').first().isVisible().catch(() => false));
  console.log('Link a[href*="carrinho"] - count:', await page.locator('a[href*="carrinho"]').count(), 'isVisible:', await page.locator('a[href*="carrinho"]').first().isVisible().catch(() => false));

  console.log('5. Clicando no botão do carrinho no DOM...');
  await cartBtn.click({ force: true }).catch(e => console.log('Erro ao clicar no botão do carrinho:', e.message));
  await page.waitForTimeout(4000);

  console.log('URL após clicar no botão do carrinho:', page.url());
  await page.screenshot({ path: path.join(outputDir, '04_carrinho_pos_clique.png') });

  // Se URL não mudou ou caiu em access=denied, verificar estado
  if (page.url().includes('access=denied')) {
    console.log('⚠️ ALERTA: Redirecionou para access=denied!');
  } else {
    console.log('✅ SUCESSO: URL do carrinho acessada:', page.url());
  }

  // Inspecionar os elementos de preço no carrinho
  const innerTextSnippet = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 1200) : '');
  console.log('Texto no corpo da página do carrinho:\n', innerTextSnippet);

  await browser.close();
})();
