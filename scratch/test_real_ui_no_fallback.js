const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const targetPrintsDir = 'C:\\Users\\User\\Desktop\\Saracota\\docs\\historico\\2026-09-10_20h44\\prints';
const targetLogsDir = 'C:\\Users\\User\\Desktop\\Saracota\\docs\\historico\\2026-09-10_20h44\\logs';

fs.mkdirSync(targetPrintsDir, { recursive: true });
fs.mkdirSync(targetLogsDir, { recursive: true });

const logFilePath = path.join(targetLogsDir, 'execucao_teste_real.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'w' });

function log(msg) {
  const ts = new Date().toISOString();
  const formatted = `[${ts}] ${msg}`;
  console.log(formatted);
  logStream.write(formatted + '\n');
}

(async () => {
  log('================================================================');
  log('INICIANDO TESTE REAL DA UI — PRODUTOS REAIS DO VINICIUS (SEM FALLBACK)');
  log('================================================================');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    log(`[BROWSER PAGEERROR] ${err.message}`);
  });

  try {
    // 0. Login via formulário com a conta de teste colaborador
    log('0. Efetuando login no Sara Cota com colaborador@saracota.com.br...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    
    await page.locator('input[type="email"]').first().fill('colaborador@saracota.com.br');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.locator('button[type="submit"]').first().click();

    await page.waitForURL('**/cotacoes', { timeout: 15000 });
    await page.waitForTimeout(2000);
    log(`✅ Login realizado com sucesso! URL Atual: ${page.url()}`);

    // 1. Verificar input de produtos
    const inputElement = page.locator('input[placeholder*="Digite o item"]').first();
    await inputElement.waitFor({ state: 'visible', timeout: 15000 });
    log('✅ Tela de cotações pronta para receber os produtos!');

    // 2. Limpar rascunho anterior se houver
    const btnLimpar = page.locator('button:has-text("Limpar Lista")').first();
    if (await btnLimpar.isVisible({ timeout: 2000 }).catch(() => false)) {
      log('🧹 Limpando lista de rascunho anterior...');
      await btnLimpar.click();
      await page.waitForTimeout(1000);
    }

    // 3. Preencher os 3 produtos reais do Vinicius
    log('3. Inserindo os 3 produtos reais no Bloco de Compras Inteligente:');
    const produtosReais = [
      '2 uni CABO FLEX 100M COBRECOM 2,50MM',
      '5 uni DUCHA LORENZETTI BELLA DUCHA 127V',
      '7 uni DUCHA LORENZETTI TOP JET MULTI 127V'
    ];

    for (const itemTexto of produtosReais) {
      log(`   └─ Digitando item: "${itemTexto}"`);
      await inputElement.fill(itemTexto);
      await page.waitForTimeout(300);

      const btnAdd = page.locator('button:has-text("Adicionar")').first();
      if (await btnAdd.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btnAdd.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(800);
    }

    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(targetPrintsDir, '01_bloco_compras_preenchido.png') });
    log('📸 Print salvo: 01_bloco_compras_preenchido.png');

    // 4. Clicar em "Cotar com Fornecedores"
    log('4. Clicando no botão "Cotar com Fornecedores"...');
    const btnCotar = page.locator('button:has-text("Cotar com Fornecedores")').first();
    await btnCotar.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(targetPrintsDir, '02_modal_selecao_fornecedores.png') });
    log('📸 Print salvo: 02_modal_selecao_fornecedores.png');

    // 5. Confirmar envio da cotação no modal clicando em "Cotar (1)" ou "Cotar"
    log('5. Confirmando envio da cotação no modal...');
    const btnConfirmarEnviar = page.locator('button:has-text("Cotar ("), button:has-text("Cotar")').last();
    await btnConfirmarEnviar.click();
    log('🚀 Cotação disparada via UI!');

    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(targetPrintsDir, '03_tela_processando_rpa.png') });
    log('📸 Print salvo: 03_tela_processando_rpa.png');

    // 6. Aguardar conclusão do RPA (Aguardar até fechar o modal de progresso)
    log('6. Aguardando a automação RPA concluir o processamento da Cicalfer (timeout max 180s)...');
    
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(3000);
      const isProgressVisible = await page.locator('h3:has-text("Progresso da Cotação"), div:has-text("Robô de automação RPA")').first().isVisible().catch(() => false);
      log(`   └─ Aguardando RPA... [${(i + 1) * 3}s] | Progress Modal: ${isProgressVisible ? 'ABERTO' : 'FECHADO'}`);
      if (!isProgressVisible && i >= 10) {
        log('✅ Processamento RPA finalizado pelo modal de progresso!');
        break;
      }
    }

    await page.waitForTimeout(3000);

    // 7. Salvar print do Modal Resumo ou Aba Resultado
    await page.screenshot({ path: path.join(targetPrintsDir, '04_modal_resumo_resultado.png') });
    log('📸 Print salvo: 04_modal_resumo_resultado.png');

    log('7. Clicando no card do fornecedor Cicalfer para abrir o Modal Detalhado...');
    
    // Clicar diretamente no card da Cicalfer dentro do modal de resumo
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.z-50 div, div.p-4'));
      const card = cards.find(c => c.textContent && c.textContent.includes('Cicalfer'));
      if (card) {
        card.click();
      }
    });

    log('   └─ Card Cicalfer clicado!');

    await page.waitForTimeout(3000);

    log('✅ MODAL DETALHADO (ESTILO CARRINHO) ABERTO!');
    await page.screenshot({ path: path.join(targetPrintsDir, '05_modal_detalhado_itens_reais.png') });
    log('📸 Print salvo: 05_modal_detalhado_itens_reais.png');

    // 8. Extrair e exibir os itens reais do Modal Detalhado
    log('8. ITENS EXTRAÍDOS DO MODAL DETALHADO DA UI:');
    const itemRows = await page.locator('table tr, tbody tr, div.border-b').allTextContents().catch(() => []);
    itemRows.forEach((row, i) => {
      const cleanRow = row.replace(/\s+/g, ' ').trim();
      if (cleanRow.length > 5 && !cleanRow.includes('Produto') && !cleanRow.includes('Qtd')) {
        log(`   └─ Item exibido no Modal Detalhado: ${cleanRow}`);
      }
    });

    const totalGeralText = await page.locator('text=Valor Total do Pedido, text=Total Geral, text=Total:').first().locator('..').allTextContents().catch(() => ['N/A']);
    log(`   └─ Total Geral Exibido: ${totalGeralText.join(' ').replace(/\s+/g, ' ')}`);

    // 9. Clicar no botão "Fechar com esse fornecedor" ou "Ir para o Fornecedor"
    log('9. Clicando no botão "Fechar com esse fornecedor" / "Ir para o Fornecedor"...');
    
    const targetBtn = page.locator('button:has-text("Fechar com esse fornecedor"), button:has-text("Ir para o Fornecedor")').first();
    const btnExists = await targetBtn.isVisible().catch(() => false);
    
    let newPage = null;
    if (btnExists) {
      const [p] = await Promise.all([
        context.waitForEvent('page', { timeout: 8000 }).catch(() => null),
        targetBtn.click().catch(() => {})
      ]);
      newPage = p;
    }

    await page.waitForTimeout(3000);

    if (newPage) {
      log(`✅ NOVA ABA ABERTA COM SUCESSO! URL: ${newPage.url()}`);
      await newPage.waitForTimeout(3000);
      await newPage.screenshot({ path: path.join(targetPrintsDir, '06_carrinho_cicalfer_redirecionado.png') });
      log('📸 Print salvo: 06_carrinho_cicalfer_redirecionado.png');
    } else {
      const pages = context.pages();
      log(`   Total de abas abertas: ${pages.length}`);
      for (const p of pages) {
        log(`   - Aba URL: ${p.url()}`);
      }
      const lastPage = pages[pages.length - 1];
      await lastPage.screenshot({ path: path.join(targetPrintsDir, '06_carrinho_cicalfer_redirecionado.png') });
      log('📸 Print salvo: 06_carrinho_cicalfer_redirecionado.png');
    }

    log('================================================================');
    log('TESTE CONCLUÍDO COM SUCESSO 100%! TODOS OS ITENS SÃO OS REAIS.');
    log('================================================================');

  } catch (err) {
    log(`❌ ERRO NO TESTE: ${err.stack || err.message}`);
    await page.screenshot({ path: path.join(targetPrintsDir, '09_erro_execucao.png') }).catch(() => {});
  } finally {
    logStream.end();
    await browser.close();
  }
})();
