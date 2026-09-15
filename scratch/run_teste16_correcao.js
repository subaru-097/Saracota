const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🚀 [TESTE 16] Iniciando automação via Playwright na interface SaraCota (http://localhost:3000)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const cicalferDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste16_correcao', 'cicalfer');
  if (!fs.existsSync(cicalferDir)) fs.mkdirSync(cicalferDir, { recursive: true });

  try {
    console.log('1. Navegando para http://localhost:3000/cotacoes...');
    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Ir para a aba "Nova Cotação" se existir
    const abaNova = page.locator('button:has-text("Nova Cotação"), button:has-text("Bloco de Notas")').first();
    if (await abaNova.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('   - Clicando na aba "Nova Cotação"...');
      await abaNova.click();
      await page.waitForTimeout(1000);
    }

    const inputItem = page.locator('input[placeholder*="Digite o item"]').first();
    const btnAdd = page.locator('button:has-text("Adicionar")').first();

    console.log('2. Adicionando os 2 itens do teste ao Bloco de Compras...');

    // Item 1: 3 CAIXA DA AGUA FORTLEV 310L
    await inputItem.fill('3 CAIXA DA AGUA FORTLEV 310L');
    await page.waitForTimeout(500);
    await btnAdd.click();
    await page.waitForTimeout(1000);

    // Item 2: 6 DUCHA LORENZETTI BELLA DUCHA 127V
    await inputItem.fill('6 DUCHA LORENZETTI BELLA DUCHA 127V');
    await page.waitForTimeout(500);
    await btnAdd.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(cicalferDir, '01_itens_adicionados_bloco.png'), fullPage: true });
    console.log('   - Print 01_itens_adicionados_bloco.png salvo.');

    // Clicar no botão "Cotar com Fornecedores"
    console.log('3. Clicando em "Cotar com Fornecedores"...');
    const btnCotarForn = page.locator('button:has-text("Cotar com Fornecedores")').first();
    await btnCotarForn.waitFor({ state: 'visible', timeout: 10000 });
    await btnCotarForn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(cicalferDir, '02_modal_selecao_fornecedores.png'), fullPage: true });
    console.log('   - Print 02_modal_selecao_fornecedores.png salvo.');

    // Desmarcar outros e garantir que APENAS a Cicalfer está selecionada
    console.log('4. Garantindo seleção solo da Cicalfer...');
    
    // Tenta desmarcar Construjá se estiver marcada
    const checkConstruja = page.locator('div:has-text("Construjá") input[type="checkbox"]').first();
    if (await checkConstruja.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (await checkConstruja.isChecked()) {
        await checkConstruja.uncheck({ force: true });
      }
    }

    // Tenta marcar Cicalfer se não estiver marcada
    const checkCicalfer = page.locator('div:has-text("Cicalfer") input[type="checkbox"]').first();
    if (await checkCicalfer.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!(await checkCicalfer.isChecked())) {
        await checkCicalfer.check({ force: true });
      }
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(cicalferDir, '03_cicalfer_selecionada.png'), fullPage: true });

    // Iniciar cotação autônoma
    console.log('5. Clicando em "Iniciar Cotação"...');
    const btnIniciar = page.locator('button:has-text("Iniciar Cotação"), button:has-text("Confirmar Cotação")').first();
    await btnIniciar.click({ force: true });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(cicalferDir, '04_progresso_iniciado.png'), fullPage: true });
    console.log('   - Print 04_progresso_iniciado.png salvo.');

    // Aguardar conclusão da cotação (até o modal de resumo final aparecer)
    console.log('6. Aguardando conclusão da cotação (até 3 minutos)...');
    const startWait = Date.now();
    let isDone = false;

    while (Date.now() - startWait < 180000) {
      await page.waitForTimeout(5000);
      const text = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (text.includes('Cotação concluída') || text.includes('Resumo dos Fornecedores') || text.includes('Cotação Finalizada') || text.includes('concluído')) {
        console.log('   - Cotação concluída detectada na tela!');
        isDone = true;
        break;
      }
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(cicalferDir, '05_modal_final_saracota.png'), fullPage: true });
    console.log('   - Print 05_modal_final_saracota.png salvo.');

  } catch (err) {
    console.error('❌ Erro durante o teste 16:', err);
  } finally {
    await browser.close();
    console.log('🏁 Teste 16 executado.');
  }
})();
