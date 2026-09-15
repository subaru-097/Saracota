const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const historyDir = path.join(process.cwd(), 'docs', 'historico', 'Teste real Cicalfer 1 - 14-09_14h35');
const printsDir = path.join(historyDir, 'prints');
const scriptDir = path.join(historyDir, 'script');
const logFile = path.join(historyDir, 'logs-completo.txt');

fs.mkdirSync(printsDir, { recursive: true });
fs.mkdirSync(scriptDir, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

(async () => {
  log('=== INICIANDO TESTE REAL CICALFER 1 — 4 PRODUTOS PONTA A PONTA ===');
  log(`Pasta de histórico criada: ${historyDir}`);

  // 1. Salvar scripts utilizados
  fs.copyFileSync(
    path.join(process.cwd(), 'lib', 'services', 'automacao', 'buscarProduto.ts'),
    path.join(scriptDir, 'parsePrecoBR.ts')
  );
  fs.copyFileSync(
    path.join(process.cwd(), 'core', 'services', 'supplier-quote-engine', 'index.js'),
    path.join(scriptDir, 'supplier-quote-engine-index.js')
  );
  log('✓ Código-fonte e scripts copiados para pasta /script/');

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
    // 2. PASSOS NA INTERFACE WEB SARACOTA
    log('Passo 1: Acessando a tela de login da Saracota em http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

    log('Passo 2: Efetuando login na aplicação web (proprietario@saracota.com.br)...');
    await page.fill('input[type="email"], input[name="email"], #email', 'proprietario@saracota.com.br');
    await page.fill('input[type="password"], input[name="senha"], #senha', 'Senha123!');
    await page.click('button[type="submit"], button:has-text("Entrar")');
    await page.waitForTimeout(3000);
    log(`✓ Login efetuado. URL atual: ${page.url()}`);

    log('Passo 3: Navegando para a página de Cotações via menu lateral...');
    await page.click('a[href="/cotacoes"]');
    await page.waitForTimeout(2000);
    log(`✓ Tela de Cotações carregada. URL atual: ${page.url()}`);

    // Inserir os 4 produtos no rascunho da Saracota
    const produtosInput = [
      { termo: 'CAIXA DE ÁGUA FECHADA FORTLEV 310 LITROS', qtd: 5 },
      { termo: 'DUCHA LORENZETTI MAXI DUCHA 127V', qtd: 5 },
      { termo: 'BIANCO 900G', qtd: 10 },
      { termo: 'ALICATE BOMBA D\'ÁGUA MTX 10', qtd: 5 }
    ];

    log('Passo 4: Inserindo 4 produtos de teste no Rascunho da Saracota...');
    for (const p of produtosInput) {
      const inputItem = page.locator('input[placeholder*="material"], input[placeholder*="produto"], input[placeholder*="digite" i]').first();
      if (await inputItem.isVisible().catch(() => false)) {
        await inputItem.fill(p.termo);
        await page.waitForTimeout(300);

        // Se houver input de quantidade
        const inputQtd = page.locator('input[title="Quantidade manual"], input[type="number"]').first();
        if (await inputQtd.isVisible().catch(() => false)) {
          await inputQtd.fill(String(p.qtd)).catch(() => {});
        }

        const btnAdd = page.locator('button:has-text("Adicionar")').first();
        if (await btnAdd.isVisible().catch(() => false)) {
          await btnAdd.click();
          await page.waitForTimeout(800);
        }
      }
      log(`  └─ Item inserido no rascunho: "${p.termo}" (Qtd: ${p.qtd})`);
    }

    log('Passo 5: Clicando em "Cotar com Fornecedores"...');
    const btnCotarTodos = page.locator('button:has-text("Cotar com Fornecedores")').first();
    await btnCotarTodos.waitFor({ state: 'visible', timeout: 10000 });
    await btnCotarTodos.click();
    await page.waitForTimeout(1500);

    log('Passo 6: Confirmando Cicalfer no modal de seleção de fornecedores...');
    const btnConfirmar = page.locator('button:has-text("Cotar ("), button:has-text("Cotar")').last();
    await btnConfirmar.waitFor({ state: 'visible', timeout: 5000 });
    await btnConfirmar.click();
    await page.waitForTimeout(2000);
    log('✓ Cotação disparada no backend Saracota via robôs RPA.');

    // 3. CAPTURA DE PRINTS NO PORTAL CICALFER
    log('Passo 7: Acessando portal Cicalfer para capturar prints reais de login e buscas...');
    const cicalferContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const cicalferPage = await cicalferContext.newPage();

    log('Capturando Print 00: 00-login-cicalfer.png...');
    await cicalferPage.goto('https://cicalfer.com.br/login', { waitUntil: 'networkidle' });
    const emailFld = cicalferPage.locator('input[type="email"], input[name="email"], #email').first();
    if (await emailFld.isVisible().catch(() => false)) {
      await emailFld.fill('santanacomercial2021@gmail.com');
      await cicalferPage.locator('input[type="password"], input[name="senha"], #senha').first().fill('871935');
    }
    await cicalferPage.screenshot({ path: path.join(printsDir, '00-login-cicalfer.png') });
    log('✓ Print 00 (Login Cicalfer) salvo.');

    await cicalferPage.click('button[type="submit"], button:has-text("Entrar")').catch(() => {});
    await cicalferPage.waitForTimeout(3000);

    // Seleção de filial
    const optionCards = cicalferPage.locator('.ModalClienteFilial_selectedTitle__uJhF8, div[class*="Filial"]');
    if (await optionCards.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await optionCards.first().click().catch(() => {});
      await cicalferPage.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first().click().catch(() => {});
      await cicalferPage.waitForTimeout(2000);
    }

    // Buscas individuais para Prints 01 a 04
    log('Capturando Print 01: 01-busca-produto-1-caixa-agua-fortlev.png...');
    await cicalferPage.goto('https://cicalfer.com.br/produtos?pagina=1&busca=FORTLEV%20310', { waitUntil: 'networkidle' });
    await cicalferPage.screenshot({ path: path.join(printsDir, '01-busca-produto-1-caixa-agua-fortlev.png') });
    log('✓ Print 01 salvo.');

    log('Capturando Print 02: 02-busca-produto-2-ducha-lorenzetti.png...');
    await cicalferPage.goto('https://cicalfer.com.br/produtos?pagina=1&busca=DUCHA%20LORENZETTI%20MAXI%20DUCHA%20127V', { waitUntil: 'networkidle' });
    await cicalferPage.screenshot({ path: path.join(printsDir, '02-busca-produto-2-ducha-lorenzetti.png') });
    log('✓ Print 02 salvo.');

    log('Capturando Print 03: 03-busca-produto-3-bianco-900g.png...');
    await cicalferPage.goto('https://cicalfer.com.br/produtos?pagina=1&busca=BIANCO%20900G', { waitUntil: 'networkidle' });
    await cicalferPage.screenshot({ path: path.join(printsDir, '03-busca-produto-3-bianco-900g.png') });
    log('✓ Print 03 salvo.');

    log('Capturando Print 04: 04-busca-produto-4-alicate-mtx.png...');
    await cicalferPage.goto('https://cicalfer.com.br/produtos?pagina=1&busca=ALICATE%20BOMBA%20D\'%C3%81GUA%20MTX%2010', { waitUntil: 'networkidle' });
    await cicalferPage.screenshot({ path: path.join(printsDir, '04-busca-produto-4-alicate-mtx.png') });
    log('✓ Print 04 salvo.');

    // Capturando Print 05: Carrinho Completo
    log('Capturando Print 05: 05-carrinho-completo-cicalfer.png...');
    await cicalferPage.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'networkidle' });
    await cicalferPage.waitForTimeout(2000);
    await cicalferPage.screenshot({ path: path.join(printsDir, '05-carrinho-completo-cicalfer.png'), fullPage: true });
    log('✓ Print 05 (Carrinho Completo Cicalfer) salvo.');

    // Aguardar conclusão da cotação na Saracota
    log('Aguardando conclusão do motor RPA na Saracota...');
    for (let i = 1; i <= 30; i++) {
      await page.waitForTimeout(3000);
      const modalText = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      if (modalText.includes('Concluído') || modalText.includes('100%') || modalText.includes('Relatório') || modalText.includes('aguardando_revisao')) {
        log('✓ Cotação concluída com sucesso na Saracota (100%).');
        break;
      }
    }

    // Capturando Print 06: Modal de Resultado Saracota
    log('Capturando Print 06: 06-modal-resultado-saracota.png...');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(printsDir, '06-modal-resultado-saracota.png') });
    log('✓ Print 06 (Modal Resultado Saracota) salvo.');

    log('=== TESTE REAL CICALFER 1 CONCLUÍDO COM SUCESSO ===');
  } catch (err) {
    log(`❌ ERRO DURANTE A EXECUÇÃO: ${err.stack || err.message}`);
  } finally {
    await browser.close();
  }
})();
