import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function testConstrujaPortal() {
  console.log('🚀 [TESTE 17 CONSTRUJÁ PORTAL] Testando acesso e adição de itens no portal Construjá...');

  const construjaDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste17_construja', 'construja');
  if (!fs.existsSync(construjaDir)) fs.mkdirSync(construjaDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    // 1. Acessar portal Construjá
    console.log('1. Navegando para https://www.construja.com.br/produtos...');
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Clicar em login
    const loginTrigger = page.locator('#botao-login, button:has-text("FAÇA LOGIN"), a:has-text("Entrar")').first();
    if (await loginTrigger.isVisible().catch(() => false)) {
      await loginTrigger.click({ force: true });
      await page.waitForTimeout(2000);
    }

    const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
    const passInput = page.locator('input#senha[name="senha"], input[type="password"]').first();

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('2. Preenchendo e-mail do usuario da Construjá (comercialsantana@gmail.com)...');
      await emailInput.fill('comercialsantana@gmail.com');
      await passInput.fill('53597');
      await page.waitForTimeout(1000);

      // PRINT 01: Login e-mail
      await page.screenshot({ path: path.join(construjaDir, '01_construja_login_email.png'), fullPage: false });
      console.log('📸 01_construja_login_email.png salvo.');

      const btnEntrar = page.locator('button#btn-entrar, form button#btn-entrar').first();
      await btnEntrar.click({ force: true });
      await page.waitForTimeout(4000);

      // PRINT 02: Login Sucesso
      await page.screenshot({ path: path.join(construjaDir, '02_construja_login_sucesso.png'), fullPage: false });
      console.log('📸 02_construja_login_sucesso.png salvo.');
    } else {
      console.log('Sessão já logada no portal Construjá.');
    }

    // 3. Buscar Item 1: FORTLEV - CX DAGUA C/TAMPA 1000L
    console.log('\n3. Buscando Item 1: FORTLEV - CX DAGUA C/TAMPA 1000L...');
    const searchUrl1 = 'https://www.construja.com.br/produtos?pagina=1&busca=FORTLEV%20CX%20DAGUA%20TAMPA%201000L';
    await page.goto(searchUrl1, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Adicionar item 1 (quantidade 3)
    const cardItem1 = page.locator('.ProdutoCard_title__1Fm0w, a[href*="/produto/"]').first();
    if (await cardItem1.isVisible().catch(() => false)) {
      console.log('Item 1 localizado no catálogo:', await cardItem1.innerText().catch(() => 'Item 1'));
    }

    const inputQty1 = page.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await inputQty1.isVisible().catch(() => false)) {
      await inputQty1.fill('3');
      await inputQty1.press('Enter');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: path.join(construjaDir, '03_construja_item1_busca_adicionado.png'), fullPage: false });
    console.log('📸 03_construja_item1_busca_adicionado.png salvo.');

    // 4. Buscar Item 2: VEDALIT 900ML
    console.log('\n4. Buscando Item 2: VEDALIT 900ML...');
    const searchUrl2 = 'https://www.construja.com.br/produtos?pagina=1&busca=VEDALIT%20900ML';
    await page.goto(searchUrl2, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    const inputQty2 = page.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await inputQty2.isVisible().catch(() => false)) {
      await inputQty2.fill('12');
      await inputQty2.press('Enter');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: path.join(construjaDir, '04_construja_item2_busca_adicionado.png'), fullPage: false });
    console.log('📸 04_construja_item2_busca_adicionado.png salvo.');

    // 5. Abrir Carrinho
    console.log('\n5. Abrindo carrinho Construjá...');
    await page.goto('https://www.construja.com.br/produtos/carrinho', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(construjaDir, '05_construja_carrinho_aberto.png'), fullPage: false });
    console.log('📸 05_construja_carrinho_aberto.png salvo.');

    // 6. Extrair Preços
    const cartText = await page.evaluate(() => document.body ? document.body.innerText : '');
    console.log('\n6. Conteúdo do Carrinho Construjá (Primeiros 500 chars):\n', cartText.substring(0, 500));

    await page.screenshot({ path: path.join(construjaDir, '06_construja_extracao_precos.png'), fullPage: false });
    console.log('📸 06_construja_extracao_precos.png salvo.');

  } catch (err: any) {
    console.error('❌ Erro no teste do portal Construjá:', err);
  } finally {
    await browser.close();
  }
}

testConstrujaPortal().catch(console.error);
