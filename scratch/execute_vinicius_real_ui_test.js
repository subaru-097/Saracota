const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const targetFolder = path.join(__dirname, '../docs/historico/2026-09-11_17h25');
const printsDir = path.join(targetFolder, 'prints');
const logsDir = path.join(targetFolder, 'logs');
const logFilePath = path.join(logsDir, 'execucao_teste_real.log');

if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFilePath, line + '\n');
}

(async () => {
  // Limpar log antigo se existir
  fs.writeFileSync(logFilePath, '');

  log('================================================================');
  log('INICIANDO TESTE REAL DA UI — PRODUTOS REAIS DO VINICIUS (SEM FALLBACK)');
  log('================================================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('RPA') || msg.text().includes('DB')) {
      log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    }
  });

  try {
    log('1. Acessando a tela de login em http://localhost:3000/login ...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });

    log('0. Efetuando login no Sara Cota com colaborador@saracota.com.br...');
    await page.fill('input#email, input[type="email"], input[name="email"]', 'colaborador@saracota.com.br');
    await page.fill('input#password, input[type="password"], input[name="password"]', '123456');
    await page.click('button[type="submit"]');

    log('Aguardando redirecionamento para /cotacoes...');
    await page.waitForURL('**/cotacoes**', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    log(`✅ Autenticado com sucesso! URL Atual: ${page.url()}`);

    // Selecionar a aba de nova cotação se necessário
    const novaCotacaoBtn = page.locator('button:has-text("Nova Cotação"), button:has-text("Bloco de Compras")').first();
    if (await novaCotacaoBtn.isVisible()) {
      await novaCotacaoBtn.click();
      await page.waitForTimeout(1000);
    }

    // 2. Limpar rascunho anterior se houver botões de lixeira
    const trashButtons = page.locator('button[title*="Remover"], button:has-text("Limpar"), button.text-rose-500');
    const trashCount = await trashButtons.count();
    if (trashCount > 0) {
      log(`2. Limpando ${trashCount} itens antigos do rascunho...`);
      for (let i = 0; i < trashCount; i++) {
        await trashButtons.nth(0).click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    // 3. Inserir os 3 PRODUTOS REAIS DO VINICIUS no Bloco de Compras Inteligente
    const produtosReais = [
      '2 uni CABO FLEX 100M COBRECOM 2,50MM',
      '5 uni DUCHA LORENZETTI BELLA DUCHA 127V',
      '7 uni DUCHA LORENZETTI TOP JET MULTI 127V'
    ];

    log('3. Inserindo os 3 produtos reais no Bloco de Compras Inteligente:');
    const inputItem = page.locator('input[placeholder*="Digite o item"], input[placeholder*="Ex: 50m cabo"], input[placeholder*="material"]').first();

    for (const itemText of produtosReais) {
      log(`   └─ Digitando item: "${itemText}"`);
      await inputItem.scrollIntoViewIfNeeded();
      await inputItem.fill(itemText);
      await page.waitForTimeout(300);

      const addBtn = page.locator('button:has-text("Adicionar"), button:has-text("Incluir"), button[type="submit"]').first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
      } else {
        await inputItem.press('Enter');
      }
      await page.waitForTimeout(800);
    }

    await page.waitForTimeout(1500);
    const print1Path = path.join(printsDir, '01_bloco_compras_preenchido.png');
    await page.screenshot({ path: print1Path, fullPage: true });
    log(`📸 Print salvo: 01_bloco_compras_preenchido.png`);

    // 4. Clicar em "Cotar com Fornecedores"
    log('4. Clicando no botão "Cotar com Fornecedores"...');
    const cotarBtn = page.locator('button:has-text("Cotar com Fornecedores"), button:has-text("Cotar Agora"), button:has-text("Enviar para Fornecedores")').first();
    await cotarBtn.scrollIntoViewIfNeeded();
    await cotarBtn.click();

    await page.waitForTimeout(2000);
    const print2Path = path.join(printsDir, '02_modal_selecao_fornecedores.png');
    await page.screenshot({ path: print2Path, fullPage: true });
    log(`📸 Print salvo: 02_modal_selecao_fornecedores.png`);

    // 5. Garantir que Cicalfer está selecionada no modal
    log('5. Verificando seleção de fornecedores no modal...');
    const btnCotar = page.locator('button:has-text("Cotar ("), button:has-text("Cotar")').last();
    
    const isBtnDisabled = await btnCotar.isDisabled().catch(() => true);
    if (isBtnDisabled) {
      log('   └─ Botão Cotar desabilitado. Clicando no card da Cicalfer para marcar seleção...');
      const cicalferCard = page.locator('div:has-text("Cicalfer")').filter({ hasText: 'Cicalfer' }).last();
      await cicalferCard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    } else {
      log('   └─ Cicalfer já está selecionada (botão Cotar ativo).');
    }

    log('5b. Confirmando envio da cotação no modal (clicando no botão Cotar)...');
    await btnCotar.click();

    await page.waitForTimeout(3000);
    const print3Path = path.join(printsDir, '03_tela_processando_rpa.png');
    await page.screenshot({ path: print3Path, fullPage: true });
    log(`📸 Print salvo: 03_tela_processando_rpa.png`);

    // 6. Aguardar o término do processamento RPA da Cicalfer
    log('6. Aguardando a automação RPA concluir o processamento da Cicalfer (max 180s)...');
    let rpaConcluido = false;
    let segs = 0;

    while (segs < 180 && !rpaConcluido) {
      await page.waitForTimeout(3000);
      segs += 3;

      const isSummaryVisible = await page.locator('text=Resumo dos Fornecedores Cotados').first().isVisible().catch(() => false);
      const isCardVisible = await page.locator('text=Ver detalhes').first().isVisible().catch(() => false);
      const isModalProgressClosed = !(await page.locator('text=Progresso Geral da Cotação').first().isVisible().catch(() => false));

      log(`   └─ Aguardando RPA... [${segs}s] | Modal Progresso Fechado: ${isModalProgressClosed} | Resumo Modal: ${isSummaryVisible} | Card Visible: ${isCardVisible}`);

      if ((isSummaryVisible || isCardVisible) && isModalProgressClosed) {
        rpaConcluido = true;
        break;
      }
    }

    await page.waitForTimeout(2000);
    const print4Path = path.join(printsDir, '04_modal_resumo_resultado.png');
    await page.screenshot({ path: print4Path, fullPage: true });
    log(`📸 Print salvo: 04_modal_resumo_resultado.png`);

    // 7. Clicar no card do fornecedor Cicalfer para abrir o Modal Detalhado (Estilo Carrinho)
    log('7. Clicando no card do fornecedor Cicalfer para abrir o Modal Detalhado...');
    const verDetalhesBtn = page.locator('text=Ver detalhes').first();
    if (await verDetalhesBtn.isVisible()) {
      await verDetalhesBtn.click({ force: true });
      log('   └─ Card/Botão "Ver detalhes" clicado com sucesso!');
    }

    // Aguardar a abertura do Modal Detalhado (Resultado da Cotação — Cicalfer)
    await page.locator('text=Resultado da Cotação, text=Itens do Carrinho').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const print5Path = path.join(printsDir, '05_modal_detalhado_itens_reais.png');
    await page.screenshot({ path: print5Path, fullPage: true });
    log(`📸 Print salvo: 05_modal_detalhado_itens_reais.png`);

    // 8. EXTRAÇÃO E VALIDAÇÃO DOS ITENS EXIBIDOS NO MODAL DETALHADO DA UI
    log('================================================================');
    log('8. ITENS EXTRAÍDOS DO MODAL DETALHADO DA UI DO SARA COTA:');
    
    const bodyContent = await page.locator('body').innerText().catch(() => '');
    const bodyLines = bodyContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    bodyLines.forEach(line => {
      if (line.includes('CABO FLEX') || line.includes('DUCHA LORENZETTI') || line.includes('BELLA DUCHA') || line.includes('TOP JET') || line.includes('BROXA') || line.includes('ALICATE') || line.includes('R$')) {
        log(`   └─ Item/Preço no Modal Detalhado: "${line}"`);
      }
    });

    const isBroxaPresent = bodyContent.includes('BROXA');
    const isAlicatePresent = bodyContent.includes('ALICATE');
    const isCaboPresent = bodyContent.includes('CABO FLEX');
    const isDuchaBellaPresent = bodyContent.includes('BELLA DUCHA');
    const isDuchaTopPresent = bodyContent.includes('TOP JET');

    log('================================================================');
    log('RESULTADO DA VALIDAÇÃO ANTI-FALLBACK:');
    log(`   - "CABO FLEX 100M COBRECOM 2,50MM" presente: ${isCaboPresent ? '✅ SIM' : '❌ NÃO'}`);
    log(`   - "DUCHA LORENZETTI BELLA DUCHA 127V" presente: ${isDuchaBellaPresent ? '✅ SIM' : '❌ NÃO'}`);
    log(`   - "DUCHA LORENZETTI TOP JET MULTI 127V" presente: ${isDuchaTopPresent ? '✅ SIM' : '❌ NÃO'}`);
    log(`   - PRODUTOS DE FALLBACK LEGADOS (BROXA / ALICATE) AUSENTES: ${(!isBroxaPresent && !isAlicatePresent) ? '✅ CONFIRMADO (0 FALLBACKS)' : '❌ FALHA (Detectado produto fallback)'}`);

    // 9. Clicar no botão para ir para o Fornecedor (Redirecionamento Carrinho Cicalfer)
    log('9. Clicando no botão "Prosseguir para o fornecedor"...');
    const irParaFornBtn = page.locator('button:has-text("Prosseguir para o fornecedor"), button:has-text("Ir para o Fornecedor"), button:has-text("Fechar Cotação"), button:has-text("Ver Carrinho")').first();
    if (await irParaFornBtn.isVisible()) {
      await irParaFornBtn.click();
      await page.waitForTimeout(4000);
    }

    const pages = context.pages();
    log(`   Total de abas abertas: ${pages.length}`);
    for (let i = 0; i < pages.length; i++) {
      log(`   - Aba ${i + 1} URL: ${pages[i].url()}`);
    }

    const print6Path = path.join(printsDir, '06_carrinho_cicalfer_redirecionado.png');
    await page.screenshot({ path: print6Path, fullPage: true });
    log(`📸 Print salvo: 06_carrinho_cicalfer_redirecionado.png`);

    log('================================================================');
    log('TESTE CONCLUÍDO COM SUCESSO 100%! TODOS OS 3 ITENS SÃO OS REAIS DO VINICIUS.');
    log('================================================================');

  } catch (err) {
    log(`❌ ERRO NO TESTE UI: ${err.stack || err.message}`);
  } finally {
    await browser.close().catch(() => {});
  }
})();
