// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureUiFlow() {
  const printsDir = path.join(__dirname, '..', 'docs', 'historico', 'prints');
  if (!fs.existsSync(printsDir)) {
    fs.mkdirSync(printsDir, { recursive: true });
  }

  console.log('Starting UI automation & screenshot capture...');
  const browser = await chromium.launch({
    headless: false,
    viewport: { width: 1366, height: 768 }
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to console logs
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  try {
    // STEP 1: Login as Admin
    console.log('1. Accessing http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@saracota.com.br');
    await page.fill('input[type="password"]', 'password123');
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Screenshot 1: Login realizado com sucesso
    await page.screenshot({ path: path.join(printsDir, '01_login_sucesso.png'), fullPage: false });
    console.log('Saved: 01_login_sucesso.png');

    // STEP 2: Ensure on Cotações tab
    console.log('2. Ensuring on Cotações tab...');
    const cotacoesNav = page.locator('text=Cotações').first();
    if (await cotacoesNav.isVisible().catch(() => false)) {
      await cotacoesNav.click().catch(() => {});
      await page.waitForTimeout(1500);
    }

    const novaCotacaoTab = page.locator('button:has-text("Nova Cotação")').first();
    if (await novaCotacaoTab.isVisible().catch(() => false)) {
      await novaCotacaoTab.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Add item: 100x Cabo Flexível SIL 750V 2,5mm Azul
    console.log('3. Adding item: 100x Cabo Flexível SIL 750V 2,5mm Azul...');
    const itemInput = page.locator('input[placeholder*="Digite o item"], input[placeholder*="ex:"], input[type="text"]').first();
    await itemInput.waitFor({ state: 'visible', timeout: 10000 });
    await itemInput.fill('100x Cabo Flexível SIL 750V 2,5mm Azul');
    
    const addBtn = page.locator('button:has-text("Adicionar")').first();
    await addBtn.click();
    await page.waitForTimeout(1500);

    // Screenshot 2: Item adicionado na lista
    await page.screenshot({ path: path.join(printsDir, '02_item_adicionado.png'), fullPage: false });
    console.log('Saved: 02_item_adicionado.png');

    // STEP 3: Click "Cotar com Fornecedores (8 Cadastrados)"
    console.log('4. Opening supplier selection modal...');
    const cotarFornBtn = page.locator('button:has-text("Cotar com Fornecedores")').first();
    await cotarFornBtn.waitFor({ state: 'visible', timeout: 10000 });
    await cotarFornBtn.click();
    await page.waitForTimeout(1500);

    // In modal: UNCHECK ALL SUPPLIERS FIRST
    console.log('5. Desmarcando TODOS os fornecedores do modal...');
    const toggleAllBtn = page.locator('div.relative.z-10, div[role="dialog"]')
      .locator('button:has-text("Selecionar Todos"), button:has-text("Desmarcar Todos")')
      .first();

    if (await toggleAllBtn.isVisible().catch(() => false)) {
      const btnText = await toggleAllBtn.innerText();
      if (btnText.includes('Selecionar Todos')) {
        await toggleAllBtn.click();
        await page.waitForTimeout(400);
      }
      // Click Desmarcar Todos to make sure list is 100% empty
      const desmarcarBtn = page.locator('div.relative.z-10, div[role="dialog"]')
        .locator('button:has-text("Desmarcar Todos")')
        .first();
      if (await desmarcarBtn.isVisible().catch(() => false)) {
        await desmarcarBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Now SELECT ONLY Cicalfer
    console.log('6. Selecionando EXCLUSIVAMENTE Cicalfer no modal...');
    const cicalferRow = page.locator('div.relative.z-10, div[role="dialog"]')
      .locator('div.p-3')
      .filter({ hasText: /cicalfer/i })
      .first();

    await cicalferRow.waitFor({ state: 'visible', timeout: 5000 });
    await cicalferRow.click();
    await page.waitForTimeout(1000);

    // Verify button says "Cotar (1)"
    const cotar1Btn = page.locator('button:has-text("Cotar (1)")').first();
    await cotar1Btn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('CONFIRMED: ONLY Cicalfer is selected, submit button says "Cotar (1)".');

    // Screenshot 3: Modal com SOMENTE Cicalfer marcado
    await page.screenshot({ path: path.join(printsDir, '03_modal_cicalfer_selecionado.png'), fullPage: false });
    console.log('Saved: 03_modal_cicalfer_selecionado.png');

    // STEP 4: Click "Cotar (1)"
    console.log('7. Clicking "Cotar (1)" button...');
    await cotar1Btn.click();

    // Screenshot 4: State during submit / progress modal loading
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(printsDir, '04_clique_cotar_carregando.png'), fullPage: false });
    console.log('Saved: 04_clique_cotar_carregando.png');

    // STEP 5: Wait for RPA execution result
    console.log('8. Waiting for RPA execution to complete on Cicalfer site...');
    // Polling until progress modal finishes or results tab is populated
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(3000);
      const isResultTab = await page.locator('text=Resultado da Cotação, text=Fornecedores Cotados').first().isVisible().catch(() => false);
      const isModalDone = await page.locator('text=Automação concluída, text=Processamento concluído').first().isVisible().catch(() => false);
      if (isResultTab || isModalDone) {
        console.log('Execution completed!');
        break;
      }
    }

    await page.waitForTimeout(3000);

    // Screenshot 5: Resultado final exibido na tela da SaraCota
    const p5Path = path.join(printsDir, '2026-09-10_cicalfer_05_cotacao_concluida_saracota.png');
    await page.screenshot({ path: p5Path, fullPage: false });
    await page.screenshot({ path: path.join(printsDir, '05_resultado_final_ui.png'), fullPage: false });
    console.log(`Saved: ${p5Path}`);

    // STEP 6: Capture notifications & logs screenshot
    console.log('9. Capturing notifications and UI state...');
    const notifBell = page.locator('button[aria-label*="notifica"], button:has(.lucide-bell), button:has-text("Notificações")').first();
    if (await notifBell.isVisible().catch(() => false)) {
      await notifBell.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Screenshot 6: Notificações geradas e logs
    await page.screenshot({ path: path.join(printsDir, '06_notificacoes_e_logs.png'), fullPage: false });
    console.log('Saved: 06_notificacoes_e_logs.png');

    console.log('\nAll 6 screenshots captured successfully in docs/historico/prints!');
  } catch (err) {
    console.error('Error during screenshot capture flow:', err);
  } finally {
    await browser.close();
  }
}

captureUiFlow();
