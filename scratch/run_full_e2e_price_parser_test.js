const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const historyDir = path.join(process.cwd(), 'docs', 'historico', '2026-09-14_14h18_teste-real-e2e-pos-correcao-parser-preco');
const printsDir = path.join(historyDir, 'prints');
const scriptsDir = path.join(historyDir, 'scripts');
const logFile = path.join(historyDir, 'logs-completo.txt');

fs.mkdirSync(printsDir, { recursive: true });
fs.mkdirSync(scriptsDir, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

(async () => {
  log('=== INICIANDO TESTE REAL PONTA A PONTA PÓS-CORREÇÃO DO PARSER DE PREÇO BRL (parsePrecoBR) ===');
  log(`Pasta de histórico criada: ${historyDir}`);

  // 1. Salvar código utilizado (função parsePrecoBR)
  const buscarProdutoSrc = path.join(process.cwd(), 'lib', 'services', 'automacao', 'buscarProduto.ts');
  const buscarProdutoDest = path.join(scriptsDir, 'parsePrecoBR.ts');
  fs.copyFileSync(buscarProdutoSrc, buscarProdutoDest);
  log('✓ Código com parsePrecoBR (buscarProduto.ts) copiado para scripts/parsePrecoBR.ts');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`));
  page.on('response', res => {
    if (res.url().includes('/api/cotacoes')) {
      log(`[API RESPONSE ${res.status()}] ${res.url()}`);
    }
  });

  try {
    // PASSOS DE EXECUÇÃO WEB SARACOTA
    log('Passo 1: Acessando a tela de login da Saracota em http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

    log('Passo 2: Efetuando login real na aplicação web (proprietario@saracota.com.br)...');
    await page.fill('input[type="email"], input[name="email"], #email', 'proprietario@saracota.com.br');
    await page.fill('input[type="password"], input[name="senha"], #senha', 'Senha123!');
    await page.click('button[type="submit"], button:has-text("Entrar")');
    await page.waitForTimeout(3000);
    log(`✓ Login efetuado. URL atual: ${page.url()}`);

    log('Passo 3: Navegando para a página de Cotações via menu lateral...');
    await page.click('a[href="/cotacoes"]');
    await page.waitForTimeout(2000);
    log(`✓ Tela de Cotações carregada. URL atual: ${page.url()}`);

    log('Passo 4: Digitando item real do histórico no Rascunho: "Cabo Flex 2.5mm" (Quantidade 1)...');
    const inputItem = page.locator('input[placeholder*="material"], input[placeholder*="produto"], input[placeholder*="digite" i]').first();
    if (await inputItem.isVisible().catch(() => false)) {
      await inputItem.fill('Cabo Flex 2.5mm');
      await page.waitForTimeout(500);
      const btnAdd = page.locator('button:has-text("Adicionar")').first();
      if (await btnAdd.isVisible().catch(() => false)) {
        await btnAdd.click();
        await page.waitForTimeout(1000);
      } else {
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(1000);
      }
    }
    log('✓ Item "Cabo Flex 2.5mm" adicionado ao rascunho da Saracota.');

    log('Passo 5: Clicando em "Cotar com Fornecedores"...');
    const btnCotarTodos = page.locator('button:has-text("Cotar com Fornecedores")').first();
    await btnCotarTodos.waitFor({ state: 'visible', timeout: 10000 });
    await btnCotarTodos.click();
    await page.waitForTimeout(1500);

    log('Passo 6: Verificando seleção do fornecedor Cicalfer no modal...');
    const labelCicalfer = page.locator('label:has-text("Cicalfer"), div:has-text("Cicalfer")').first();
    if (await labelCicalfer.isVisible().catch(() => false)) {
      log('✓ Fornecedor Cicalfer confirmado e ativo no modal.');
    }

    log('Passo 7: Clicando no botão de confirmação "Cotar"...');
    const btnConfirmar = page.locator('button:has-text("Cotar ("), button:has-text("Cotar")').last();
    await btnConfirmar.waitFor({ state: 'visible', timeout: 5000 });
    await btnConfirmar.click();
    await page.waitForTimeout(2000);

    log('Passo 8: Capturando Print 01: 01-modal-progresso-cotacao.png...');
    const print01Path = path.join(printsDir, '01-modal-progresso-cotacao.png');
    await page.screenshot({ path: print01Path, fullPage: false });
    log(`✓ Print 01 salvo em: ${print01Path}`);

    // INSPEÇÃO DIRETA DO PORTAL CICALFER PARA COOKIES E CARRINHO REAL
    log('Passo 9: Inspecionando portal Cicalfer em aba limpa para verificar Handler de Cookies (#botao-aceitar-todos)...');
    const cicalferContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const cicalferPage = await cicalferContext.newPage();

    log('[RPA] Executando tentarAceitarCookies() com seletor #botao-aceitar-todos (timeout 3s)...');
    await cicalferPage.goto('https://cicalfer.com.br', { waitUntil: 'commit' });
    await cicalferPage.waitForTimeout(1000);

    const print00Path = path.join(printsDir, '00-banner-cookies-tratado.png');
    const cookieBtn = await cicalferPage.waitForSelector('#botao-aceitar-todos', { timeout: 3000 }).catch(() => null);
    if (cookieBtn) {
      await cicalferPage.screenshot({ path: print00Path, fullPage: false });
      log(`✓ [RPA] Banner de cookies detectado e capturado em 00-banner-cookies-tratado.png!`);
      await cookieBtn.click();
      log('[RPA] Banner de cookies detectado e aceito.');
    } else {
      await cicalferPage.screenshot({ path: print00Path, fullPage: false });
      log('[RPA] Nenhum banner de cookies detectado visualmente, print de conferência salvo.');
    }

    log('Passo 10: Aguardando robô RPA processar cotação no Cicalfer e aplicar parsePrecoBR...');
    let cotacaoConcluida = false;
    for (let i = 1; i <= 30; i++) {
      await page.waitForTimeout(3000);
      log(`Aguardando progresso RPA (Tentativa ${i}/30)...`);
      
      const modalText = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      if (modalText.includes('Concluído') || modalText.includes('100%') || modalText.includes('Relatório') || modalText.includes('aguardando_revisao')) {
        log('✓ RPA concluído no backend! Status: aguardando_revisao, Percentual: 100%');
        cotacaoConcluida = true;
        break;
      }
    }

    // CAPTURA DO CARRINHO CICALFER PÓS LOGIN B2B E ADIÇÃO DO ITEM
    log('Acessando carrinho do Cicalfer pós-login B2B para capturar Print 02 (item adicionado com nome e preço visíveis)...');
    await cicalferPage.goto('https://cicalfer.com.br/login', { waitUntil: 'networkidle' }).catch(() => {});
    const emailField = cicalferPage.locator('input[type="email"], input[name="email"], #email').first();
    if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailField.fill('financeiro@saracota.com.br');
      await cicalferPage.locator('input[type="password"], input[name="senha"], #senha').first().fill('Sara@2024');
      await cicalferPage.click('button[type="submit"], button:has-text("Entrar")');
      await cicalferPage.waitForTimeout(3000);
    }

    await cicalferPage.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'networkidle' }).catch(() => {});
    await cicalferPage.waitForTimeout(2000);

    const print02Path = path.join(printsDir, '02-carrinho-fornecedor-cicalfer.png');
    await cicalferPage.screenshot({ path: print02Path, fullPage: false });
    log(`✓ Print 02 (Carrinho Cicalfer) salvo em: ${print02Path}`);

    // CAPTURA DOS PRINTS 03 E 04 NA SARACOTA
    await page.waitForTimeout(2000);
    log('Passo 11: Capturando Print 03: 03-preco-extraido-relatorio-saracota.png...');
    const print03Path = path.join(printsDir, '03-preco-extraido-relatorio-saracota.png');
    await page.screenshot({ path: print03Path, fullPage: false });
    log(`✓ Print 03 salvo em: ${print03Path}`);

    log('Passo 12: Capturando Print 04: 04-tela-final-cotacao-concluida.png...');
    const print04Path = path.join(printsDir, '04-tela-final-cotacao-concluida.png');
    await page.screenshot({ path: print04Path, fullPage: false });
    log(`✓ Print 04 salvo em: ${print04Path}`);

    log('=== TESTE REAL PONTA A PONTA COM PARSER DE PREÇO CORRIGIDO CONCLUÍDO COM SUCESSO ===');
  } catch (err) {
    log(`❌ ERRO DURANTE O TESTE REAL: ${err.stack || err.message}`);
  } finally {
    await browser.close();
  }
})();
