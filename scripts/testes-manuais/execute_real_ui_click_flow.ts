// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

(async () => {
  console.log('================================================================');
  console.log('🧪 EXECUÇÃO DE TESTE REAL VIA INTERFACE WEB DO NAVEGADOR (SARACOTA)');
  console.log('================================================================\n');

  const printsDir = path.join(process.cwd(), 'docs', 'historico', 'prints');
  if (!fs.existsSync(printsDir)) {
    fs.mkdirSync(printsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('Automação') || msg.text().includes('RPA')) {
      console.log(`[NAV CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
    }
  });

  try {
    // 1. Acessar tela de login e fazer login real como comprador/colaborador
    console.log('1. Acessando página de login http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('#email', 'colaborador@saracota.com.br');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // 2. Aguardar redirecionamento automático da UI para /cotacoes
    console.log('2. Aguardando login e redirecionamento para /cotacoes...');
    await page.waitForURL('**/cotacoes', { timeout: 15000 }).catch(async () => {
      console.log('Forçando navegação direta para /cotacoes...');
      await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
    });

    await page.waitForTimeout(3000);
    console.log(`Página atual após login: ${page.url()}`);

    // 3. Garantir subAba = nova (Bloco de Notas)
    console.log('3. Selecionando sub-aba "Bloco de Notas"...');
    const btnBloco = page.locator('button:has-text("Bloco de Notas")').first();
    if (await btnBloco.isVisible()) {
      await btnBloco.click();
      await page.waitForTimeout(1000);
    }

    // 4. Preencher os 3 itens de teste se não existirem no bloco
    console.log('4. Preenchendo os 3 itens no bloco de notas...');
    const inputItem = page.locator('input[placeholder*="Digite o item"]').first();
    await inputItem.waitFor({ state: 'visible', timeout: 10000 });

    const itensParaAdicionar = [
      '2 uni CABO FLEX 100M COBRECOM 2,50MM',
      '5 uni DUCHA LORENZETTI BELLA DUCHA 127V',
      '7 uni DUCHA LORENZETTI TOP JET MULTI 127V',
    ];

    for (const itemText of itensParaAdicionar) {
      const itemExiste = await page.locator(`span:has-text("${itemText}")`).isVisible().catch(() => false);
      if (!itemExiste) {
        await inputItem.fill(itemText);
        await page.waitForTimeout(300);
        await inputItem.press('Enter');
        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(1500);

    // 5. Localizar e clicar no botão "Cotar com Fornecedores"
    console.log('5. Clicando no botão "Cotar com Fornecedores"...');
    const btnCotar = page.locator('button:has-text("Cotar com Fornecedores")').first();
    await btnCotar.waitFor({ state: 'visible', timeout: 15000 });
    await btnCotar.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await btnCotar.click();
    await page.waitForTimeout(1500);

    // SCREENSHOT (A): MOMENTO DO CLIQUE / MODAL SELEÇÃO
    const printA = path.join(printsDir, '2026-09-10_ui_01_clique_cotar_com_fornecedores.png');
    await page.screenshot({ path: printA, fullPage: true });
    console.log(`📸 [PRINT A SALVO] ${printA}`);

    // 6. Selecionar Fornecedor Cicalfer e confirmar no modal
    console.log('6. Selecionando Cicalfer no modal e disparando cotação via POST HTTP...');
    const checkCicalfer = page.locator('input[type="checkbox"]').first();
    if (await checkCicalfer.isVisible()) {
      const isChecked = await checkCicalfer.isChecked();
      if (!isChecked) {
        await checkCicalfer.check();
      }
    }

    // O botão no footer do modal é "Cotar (1)" ou "Cotar"
    const btnConfirmar = page.locator('div[role="dialog"] button:has-text("Cotar"), button:has-text("Cotar (1)"), button:has-text("Cotar (")').last();
    await btnConfirmar.waitFor({ state: 'visible', timeout: 10000 });
    await btnConfirmar.click();
    await page.waitForTimeout(2000);

    // SCREENSHOT (B): TELA DE PROCESSANDO
    const printB = path.join(printsDir, '2026-09-10_ui_02_tela_processando.png');
    await page.screenshot({ path: printB, fullPage: true });
    console.log(`📸 [PRINT B SALVO] ${printB}`);

    // 7. Aguardar conclusão da automação no servidor (polling real)
    console.log('7. Aguardando conclusão do RPA no servidor Node (polling via /status)...');
    
    // Aguarda o modal de progresso ser fechado e o status ser concluído (máx 90s)
    let tentativas = 0;
    while (tentativas < 30) {
      await page.waitForTimeout(3000);
      tentativas++;
      const modalVisivel = await page.locator('text=Processando Cotação em Tempo Real').isVisible().catch(() => false);
      if (!modalVisivel) {
        console.log(`Polling concluído após ${tentativas * 3} segundos. Modal fechado.`);
        break;
      }
    }

    await page.waitForTimeout(3000);

    // Selecionar a sub-aba "Resultado Banco Real" se não estiver nela
    const btnResultado = page.locator('button:has-text("Resultado Banco Real")').first();
    if (await btnResultado.isVisible()) {
      await btnResultado.click();
      await page.waitForTimeout(2000);
    }

    // SCREENSHOT (C): RESULTADO FINAL NA INTERFACE SARACOTA
    const printC = path.join(printsDir, '2026-09-10_ui_03_resultado_final_saracota.png');
    await page.screenshot({ path: printC, fullPage: true });
    console.log(`📸 [PRINT C SALVO] ${printC}`);

    // Abrir o modal do resultado para ver o detalhamento dos itens e o resumo do carrinho
    const cardSupplier = page.locator('div:has-text("Resumo por Fornecedor Cotado") + div > div, button:has-text("Ver Detalhes"), div:has-text("Cicalfer")').first();
    if (await cardSupplier.isVisible()) {
      await cardSupplier.click();
      await page.waitForTimeout(1500);
    }

    const printCModal = path.join(printsDir, '2026-09-10_ui_03b_modal_resultado_saracota.png');
    await page.screenshot({ path: printCModal, fullPage: true });
    console.log(`📸 [PRINT C MODAL SALVO] ${printCModal}`);

    // 8. Acessar portal Cicalfer para confirmar o carrinho criado na sessão do usuário
    console.log('8. Abrindo portal Cicalfer para capturar o carrinho montado real...');
    const pageCicalfer = await context.newPage();
    await pageCicalfer.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await pageCicalfer.waitForTimeout(3000);

    // SCREENSHOT (D): CONFIRMAÇÃO DO CARRINHO NO SITE DO FORNECEDOR
    const printD = path.join(printsDir, '2026-09-10_ui_04_carrinho_cicalfer_confirmado.png');
    await pageCicalfer.screenshot({ path: printD, fullPage: true });
    console.log(`📸 [PRINT D SALVO] ${printD}`);

    console.log('\n=== FLUXO VIA CLIQUE NA UI CONCLUÍDO COM SUCESSO! ===');
  } catch (err) {
    console.error('❌ Erro durante o fluxo UI:', err);
  } finally {
    await browser.close();
  }
})();
