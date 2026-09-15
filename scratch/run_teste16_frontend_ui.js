const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🚀 [TESTE 16 UI] Executando teste visual completo pela interface SaraCota (http://localhost:3000/cotacoes)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const cicalferDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste16_correcao', 'cicalfer');
  const construjaDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste16_correcao', 'construja');
  if (!fs.existsSync(cicalferDir)) fs.mkdirSync(cicalferDir, { recursive: true });
  if (!fs.existsSync(construjaDir)) fs.mkdirSync(construjaDir, { recursive: true });

  try {
    console.log('\n================================================================');
    console.log('1. TESTE SOLO CICALFER VIA INTERFACE REAL');
    console.log('================================================================');
    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const inputItem = page.locator('input[placeholder*="Digite o item"]').first();
    const btnAdd = page.locator('button:has-text("Adicionar")').first();

    // Adicionar 2 itens
    console.log('   - Adicionando Item 1: 3 CAIXA DA AGUA FORTLEV 310L...');
    await inputItem.fill('3 CAIXA DA AGUA FORTLEV 310L');
    await page.waitForTimeout(500);
    await btnAdd.click();
    await page.waitForTimeout(1000);

    console.log('   - Adicionando Item 2: 6 DUCHA LORENZETTI BELLA DUCHA 127V...');
    await inputItem.fill('6 DUCHA LORENZETTI BELLA DUCHA 127V');
    await page.waitForTimeout(500);
    await btnAdd.click();
    await page.waitForTimeout(1000);

    // Clicar em Cotar com Fornecedores
    const btnCotarForn = page.locator('button:has-text("Cotar com Fornecedores")').first();
    await btnCotarForn.waitFor({ state: 'visible', timeout: 10000 });
    await btnCotarForn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(cicalferDir, '01_fornecedores_selecionados.png'), fullPage: true });
    console.log('   - Screenshot 01_fornecedores_selecionados.png salvo.');

    // Selecionar APENAS Cicalfer
    const checkConstruja = page.locator('div:has-text("Construjá") input[type="checkbox"]').first();
    if (await checkConstruja.isVisible().catch(() => false)) {
      if (await checkConstruja.isChecked()) {
        await checkConstruja.uncheck({ force: true });
      }
    }

    const checkCicalfer = page.locator('div:has-text("Cicalfer") input[type="checkbox"]').first();
    if (await checkCicalfer.isVisible().catch(() => false)) {
      if (!(await checkCicalfer.isChecked())) {
        await checkCicalfer.check({ force: true });
      }
    }

    await page.waitForTimeout(1000);

    // Iniciar Cotação
    const btnIniciar = page.locator('button:has-text("Iniciar Cotação"), button:has-text("Confirmar Cotação")').first();
    await btnIniciar.click({ force: true });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(cicalferDir, '02_modal_progresso_iniciado.png'), fullPage: true });
    console.log('   - Screenshot 02_modal_progresso_iniciado.png salvo.');

    await page.waitForTimeout(15000);
    await page.screenshot({ path: path.join(cicalferDir, '03_processamento_rpa.png'), fullPage: true });
    console.log('   - Screenshot 03_processamento_rpa.png salvo.');

    // Aguardar finalização da cotação
    console.log('   - Aguardando conclusão da cotação Cicalfer...');
    const startWait = Date.now();
    while (Date.now() - startWait < 120000) {
      await page.waitForTimeout(5000);
      const text = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (text.includes('Cotação concluída') || text.includes('Resumo dos Fornecedores') || text.includes('100%')) {
        console.log('   - Cotação concluída com sucesso!');
        break;
      }
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(cicalferDir, '04_modal_final_saracota.png'), fullPage: true });
    console.log('   - Screenshot 04_modal_final_saracota.png salvo.');

    console.log('\n================================================================');
    console.log('2. TESTE SOLO CONSTRUJÁ VIA INTERFACE REAL');
    console.log('================================================================');

    // Fechar modais anteriores se houver
    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const inputItem2 = page.locator('input[placeholder*="Digite o item"]').first();
    const btnAdd2 = page.locator('button:has-text("Adicionar")').first();

    await inputItem2.fill('3 CAIXA DA AGUA FORTLEV 310L');
    await page.waitForTimeout(500);
    await btnAdd2.click();
    await page.waitForTimeout(1000);

    await inputItem2.fill('6 DUCHA LORENZETTI BELLA DUCHA 127V');
    await page.waitForTimeout(500);
    await btnAdd2.click();
    await page.waitForTimeout(1000);

    const btnCotarForn2 = page.locator('button:has-text("Cotar com Fornecedores")').first();
    await btnCotarForn2.waitFor({ state: 'visible', timeout: 10000 });
    await btnCotarForn2.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(construjaDir, '01_fornecedores_selecionados.png'), fullPage: true });

    // Selecionar APENAS Construjá
    const checkCicalfer2 = page.locator('div:has-text("Cicalfer") input[type="checkbox"]').first();
    if (await checkCicalfer2.isVisible().catch(() => false)) {
      if (await checkCicalfer2.isChecked()) {
        await checkCicalfer2.uncheck({ force: true });
      }
    }

    const checkConstruja2 = page.locator('div:has-text("Construjá") input[type="checkbox"]').first();
    if (await checkConstruja2.isVisible().catch(() => false)) {
      if (!(await checkConstruja2.isChecked())) {
        await checkConstruja2.check({ force: true });
      }
    }

    await page.waitForTimeout(1000);

    const btnIniciar2 = page.locator('button:has-text("Iniciar Cotação"), button:has-text("Confirmar Cotação")').first();
    await btnIniciar2.click({ force: true });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(construjaDir, '02_modal_progresso_iniciado.png'), fullPage: true });

    const startWait2 = Date.now();
    while (Date.now() - startWait2 < 120000) {
      await page.waitForTimeout(5000);
      const text = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (text.includes('Cotação concluída') || text.includes('Resumo dos Fornecedores') || text.includes('100%')) {
        break;
      }
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(construjaDir, '03_modal_final_saracota.png'), fullPage: true });
    console.log('   - Screenshots Construjá salvos com sucesso.');

  } catch (err) {
    console.error('❌ Erro no teste UI:', err);
  } finally {
    await browser.close();
    console.log('🏁 Teste UI finalizado.');
  }
})();
