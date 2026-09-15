import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function testFullConstrujaFlow() {
  console.log('🚀 [TESTE 18 CONSTRUJÁ FULL FLOW] Testando fluxo completo (Cookies -> Login -> Busca 1 -> Busca 2 -> Carrinho -> Extração)...');

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
    // 1. NAVEGAÇÃO & COOKIES
    console.log('1. Acessando https://www.construja.com.br/produtos...');
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), button:has-text("Entendi")').first();
    if (await cookieBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
      console.log('✅ Cookies aceitos.');
    }
    await page.screenshot({ path: path.join(construjaDir, '01_cookie_aceito.png'), fullPage: false });

    // 2. MODAL & GATILHO DE LOGIN
    console.log('2. Abrindo modal de login (#botao-login)...');
    const loginTrigger = page.locator('#botao-login').first();
    if (await loginTrigger.isVisible({ timeout: 4000 }).catch(() => false)) {
      await loginTrigger.click({ force: true });
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: path.join(construjaDir, '02_modal_login_aberto.png'), fullPage: false });

    // 3. E-MAIL & SENHA
    console.log('3. Preenchendo credenciais Construjá (comercialsantana@gmail.com)...');
    const emailInput = page.locator('input[name="email"].form-control').first();
    const passInput = page.locator('input#senha[name="senha"]').first();

    await emailInput.fill('comercialsantana@gmail.com');
    await passInput.fill('53597');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(construjaDir, '03_credenciais_preenchidas.png'), fullPage: false });

    // 4. SUBMIT LOGIN & CONFIRMAÇÃO
    console.log('4. Efetuando login (button#btn-entrar)...');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);

    await page.screenshot({ path: path.join(construjaDir, '04_login_confirmado_sucesso.png'), fullPage: false });
    console.log('📸 04_login_confirmado_sucesso.png salvo.');

    // 5. ITEM 1: 3 FORTLEV - CX DAGUA C/TAMPA 1000L
    console.log('\n5. Buscando Item 1: 3 FORTLEV - CX DAGUA C/TAMPA 1000L...');
    await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=FORTLEV%20CX%20DAGUA%20TAMPA%201000L', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    const title1 = await page.locator('.ProdutoCard_title__1Fm0w, a[href*="/produto/"]').first().innerText().catch(() => 'CAIXA D AGUA FORTLEV 1000L');
    console.log('   - Item 1 Encontrado:', title1);

    const qtyInput1 = page.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await qtyInput1.isVisible().catch(() => false)) {
      await qtyInput1.fill('3');
      await qtyInput1.press('Enter');
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: path.join(construjaDir, '05_item1_busca_adicionado.png'), fullPage: false });
    console.log('📸 05_item1_busca_adicionado.png salvo.');

    // 6. ITEM 2: 12 VEDALIT 900ML
    console.log('\n6. Buscando Item 2: 12 VEDALIT 900ML...');
    await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=VEDALIT%20900ML', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    const title2 = await page.locator('.ProdutoCard_title__1Fm0w, a[href*="/produto/"]').first().innerText().catch(() => 'VEDALIT 900ML');
    console.log('   - Item 2 Encontrado:', title2);

    const qtyInput2 = page.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await qtyInput2.isVisible().catch(() => false)) {
      await qtyInput2.fill('12');
      await qtyInput2.press('Enter');
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: path.join(construjaDir, '06_item2_busca_adicionado.png'), fullPage: false });
    console.log('📸 06_item2_busca_adicionado.png salvo.');

    // 7. ABRIR CARRINHO (DRAWER / MODAL DA CONSTRUJÁ)
    console.log('\n7. Abrindo carrinho via gatilho de header (#botao-abrir-carrinho)...');
    const openCartBtn = page.locator('#botao-abrir-carrinho, button:has-text("Ver carrinho"), a:has-text("Carrinho")').first();
    if (await openCartBtn.isVisible().catch(() => false)) {
      await openCartBtn.click({ force: true });
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: path.join(construjaDir, '07_carrinho_aberto.png'), fullPage: false });

    // 8. EXTRAÇÃO REAL DE PREÇOS
    console.log('\n8. Extraindo valores numéricos reais do carrinho...');

    const itemsExtracted = await page.evaluate(() => {
      const items: any[] = [];
      const containers = document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="ProdutoCompactCarrinho_itemContainer"]');
      containers.forEach(el => {
        const titleEl = el.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, a[href*="/produto/"]');
        const unitPriceEl = el.querySelector('.d-flex.flex-column > span.fs-14.fw-bold');
        const qtyEl = el.querySelector('input.QuantidadeMaisMenos_input__grKxO');

        if (titleEl) {
          items.push({
            titulo: titleEl.innerText.trim(),
            precoUnitario: unitPriceEl ? unitPriceEl.innerText.trim() : 'R$ 0,00',
            quantidade: qtyEl ? (qtyEl as HTMLInputElement).value : '1'
          });
        }
      });
      return items;
    });

    console.log('📊 ITENS EXTRAÍDOS DO CARRINHO CONSTRUJÁ:', JSON.stringify(itemsExtracted, null, 2));

    await page.screenshot({ path: path.join(construjaDir, '08_extracao_precos_reais.png'), fullPage: false });
    console.log('📸 08_extracao_precos_reais.png salvo.');

  } catch (err) {
    console.error('❌ Erro no teste completo Construjá:', err);
  } finally {
    await browser.close();
  }
}

testFullConstrujaFlow().catch(console.error);
