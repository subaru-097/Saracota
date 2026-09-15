// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== DIAGNÓSTICO DO FLUXO REAL CICALFER (COM DISMISS DE COOKIE E SELETOR REAL) ===');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });

  try {
    console.log('1. Navegando para https://cicalfer.com.br/ ...');
    await page.goto('https://cicalfer.com.br/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // ETAPA A: Aceitar Cookies
    console.log('2. Verificando e aceitando cookies...');
    const cookieBtn = page.locator('button:has-text("Aceitar todos"), button:has-text("Aceitar")').first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicando no botão de Aceitar Cookies...');
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: path.join(process.cwd(), 'docs', 'historico', 'prints', '08_diag_pre_login.png') });

    // ETAPA B: Abrir Modal de Login
    console.log('3. Clicando no botão "Entrar | Cadastrar"...');
    const loginTrigger = page.locator('.dropdown:has-text("Entrar"), a:has-text("Entrar"), button:has-text("Entrar")').first();
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(process.cwd(), 'docs', 'historico', 'prints', '09_diag_modal_login.png') });

    // ETAPA C: Preencher Credenciais
    const emailInput = page.locator('input[name="email"]').first();
    const isEmailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Campo de email visível após clicar em Entrar? ${isEmailVisible}`);

    if (isEmailVisible) {
      console.log('Preenchendo e-mail (admin@saracota.com.br) e senha (password123)...');
      await emailInput.fill('admin@saracota.com.br');
      await page.locator('input[type="password"]').first().fill('password123');
      await page.locator('.modal button[type="submit"], button#btn-entrar').first().click({ force: true });
      await page.waitForTimeout(4000);
    }

    await page.screenshot({ path: path.join(process.cwd(), 'docs', 'historico', 'prints', '10_diag_pos_login.png') });

    const postLoginState = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const filialCards = Array.from(document.querySelectorAll('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial')).map(el => el.innerText);
      return {
        url: window.location.href,
        hasEntrarText: bodyText.includes('Entrar | Cadastrar'),
        hasErroLoginMsg: bodyText.includes('inválid') || bodyText.includes('incorret') || bodyText.includes('não encontrado') || bodyText.includes('Erro'),
        filialCardsCount: filialCards.length,
        filialCardsText: filialCards,
        bodySnippet: bodyText.slice(0, 300).replace(/\n+/g, ' ')
      };
    });
    console.log('Estado pós-login:', JSON.stringify(postLoginState, null, 2));

    // ETAPA D: Seleção de Filial B2B
    console.log('\n4. Verificando modal de Filial B2B...');
    const filialOption = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial').first();
    if (await filialOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Modal de Filial detectado! Clicando na filial...');
      await filialOption.click({ force: true });
      await page.waitForTimeout(1000);
      const confirmFilialBtn = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
      if (await confirmFilialBtn.isVisible().catch(() => false)) {
        await confirmFilialBtn.click({ force: true });
        await page.waitForTimeout(2000);
      }
      console.log('Recarregando página para reidratação de cookies B2B da filial...');
      await page.reload({ waitUntil: 'commit' });
      await page.waitForTimeout(3000);
    }

    // ETAPA E: Busca do Produto
    console.log('\n5. Executando busca do produto "Cabo Flexível SIL 750V 2,5mm Azul"...');
    const searchInput = page.locator('input[name="search"]').first();
    await searchInput.fill('Cabo Flexível SIL 750V 2,5mm Azul');
    await page.locator('button#botao-busca-produtos').first().click({ force: true });
    await page.waitForTimeout(5000);

    await page.screenshot({ path: path.join(process.cwd(), 'docs', 'historico', 'prints', '11_diag_resultado_busca.png') });

    const searchResult = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const prices = bodyText.match(/R\$\s*\d+[\.,]\d{2}/g) || [];
      const quantInputs = Array.from(document.querySelectorAll('input')).filter(i => 
        i.className.includes('Quantidade') || i.className.includes('input') || i.type === 'number'
      ).map(i => ({ className: i.className, outerHTML: i.outerHTML }));

      return {
        url: window.location.href,
        hasProdutoNaoEncontradoMsg: bodyText.includes('Produto não encontrado'),
        hasFacaLoginMsg: bodyText.includes('FAÇA LOGIN OU CADASTRE-SE'),
        pricesFoundCount: prices.length,
        pricesSample: prices.slice(0, 5),
        quantInputsCount: quantInputs.length,
        quantInputsSample: quantInputs.slice(0, 5),
        bodySnippet: bodyText.slice(0, 400).replace(/\n+/g, ' ')
      };
    });

    console.log('Resultado da busca pós-login:', JSON.stringify(searchResult, null, 2));

  } catch (err) {
    console.error('Erro no diagnóstico:', err);
  } finally {
    await browser.close();
  }
})();
