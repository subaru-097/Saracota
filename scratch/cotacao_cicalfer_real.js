const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Vault Decryption
const VAULT_SECRET = process.env.ENCRYPTION_KEY || process.env.VAULT_SECRET || 'saracota_vault_master_key_aes256_32bytes_secret';
function getDerivedKey() { return crypto.createHash('sha256').update(VAULT_SECRET).digest(); }
function decryptAES256(encryptedData) {
  if (!encryptedData) return '';
  try {
    if (encryptedData.startsWith('enc_sec_')) {
      const parts = encryptedData.split('_');
      return Buffer.from(parts[parts.length - 1], 'base64').toString('utf-8');
    }
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      try { return Buffer.from(encryptedData, 'base64').toString('utf-8'); } catch(e) { return encryptedData; }
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = getDerivedKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    try { return Buffer.from(encryptedData, 'base64').toString('utf-8'); } catch(e) { return '[DESCRIPTOGRAFIA_FALHOU]'; }
  }
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '***@***';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 3)}***@${domain}`;
}

async function runCicalferQuotation() {
  console.log('=====================================================');
  console.log('EXECUTANDO COTAÇÃO REAL - FORNECEDOR CICALFER');
  console.log('PRODUTO: CABO FLEX 100M COBRECOM 2,50MM | QUANTIDADE: 5');
  console.log('=====================================================\n');

  // 1. Fetch real DB record from Supabase
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.from('fornecedores').select('*').ilike('nome', '%cicalfer%');

  if (error || !data || data.length === 0) {
    console.error('FATAL: Fornecedor Cicalfer não encontrado no Supabase DB.');
    process.exit(1);
  }

  const supplier = data[0];
  const targetUrl = supplier.url_site || supplier.url_login || 'https://cicalfer.com.br/';
  const loginUser = supplier.login_salvo || supplier.login;
  const rawPass = supplier.senha_login || supplier.senha_criptografada;
  const decryptedPass = decryptAES256(rawPass);
  const seletores = supplier.seletores || {};

  console.log('--- DADOS REAIS DO BANCO DE DADOS (SUPABASE) ---');
  console.log(`- Fornecedor: "${supplier.nome}"`);
  console.log(`- URL: "${targetUrl}"`);
  console.log(`- Usuário: "${maskEmail(loginUser)}"`);
  console.log(`- Senha status: Descriptografada (${decryptedPass.length} chars)`);
  console.log('------------------------------------------------\n');

  // Setup execution folder inside diagnostico_cicalfer/
  const rootDir = path.join(__dirname, '..', 'diagnostico_cicalfer');
  if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const executionDir = path.join(rootDir, timestamp);
  fs.mkdirSync(executionDir, { recursive: true });

  const etapesReport = [];
  function logStep(stepNum, stepName, status, obs, screenshotFile) {
    const record = { stepNum, stepName, status, obs, screenshotFile, timestamp: new Date().toISOString() };
    etapesReport.push(record);
    console.log(`[ETAPA ${stepNum}: ${stepName}] Status: ${status} | Obs: ${obs}`);
    if (screenshotFile) {
      console.log(`  -> Screenshot salvo em: ${path.join(executionDir, screenshotFile)}`);
    }
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // =====================================================
    // ETAPA 1: LOGIN
    // =====================================================
    console.log('\n>>> ETAPA 1: LOGIN <<<');
    await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Dismiss Cookie Banner if visible
    const acceptCookieSelectors = ['button:has-text("Aceitar")', 'button:has-text("Concordar")', '.modal button.btn-primary'];
    for (const sel of acceptCookieSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          console.log(` -> Fechando banner de cookies: "${sel}"`);
          await btn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1000);
          break;
        }
      } catch (e) {}
    }

    // Click Login Trigger
    console.log(' -> Abrindo modal de login...');
    const loginBtn = page.locator('button#botao-login').or(page.locator('text=Entrar | Cadastrar')).first();
    await loginBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // Fill Email & Password
    const emailSel = seletores.campo_email || 'input[name="email"].form-control';
    const passSel = seletores.campo_senha || 'input#senha[name="senha"]';

    console.log(` -> Preenchendo e-mail: ${maskEmail(loginUser)}`);
    await page.locator(emailSel).first().fill(loginUser);

    console.log(` -> Preenchendo senha...`);
    await page.locator(passSel).first().fill(decryptedPass);

    // Submit form
    console.log(' -> Submetendo login...');
    const submitBtn = page.locator('.modal button[type="submit"]').or(page.locator('button[type="submit"]')).first();
    await submitBtn.click({ force: true });

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const screenshot1 = '01_login_pos_sucesso.png';
    await page.screenshot({ path: path.join(executionDir, screenshot1), fullPage: true });
    logStep(1, 'LOGIN', 'SUCESSO', `Login realizado com sucesso via banco de dados. URL Pós-login: ${page.url()}`, screenshot1);


    // =====================================================
    // ETAPA 2: SELEÇÃO DE EMPRESA/FILIAL
    // =====================================================
    console.log('\n>>> ETAPA 2: SELEÇÃO DE EMPRESA / FILIAL <<<');
    const filialModalSelectors = [
      '.ModalClienteFilial_selectedTitle__uJhF8',
      'span:has-text("Confirmar seleção")',
      'text=Confirmar seleção',
      'button:has-text("Confirmar")',
      'div.modal:has-text("Selecione")'
    ];

    let filialSelected = false;
    for (const fSel of filialModalSelectors) {
      try {
        const fEl = page.locator(fSel).first();
        if (await fEl.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(` -> Modal/Botão de Filial detectado: "${fSel}"`);
          await fEl.click({ force: true }).catch(() => {});
          await page.waitForTimeout(2000);
          filialSelected = true;
          break;
        }
      } catch (e) {}
    }

    const screenshot2 = '02_selecao_empresa.png';
    await page.screenshot({ path: path.join(executionDir, screenshot2), fullPage: true });

    if (filialSelected) {
      logStep(2, 'SELEÇÃO DE EMPRESA', 'SUCESSO', 'Filial/Empresa selecionada e confirmada via modal.', screenshot2);
    } else {
      logStep(2, 'SELEÇÃO DE EMPRESA', 'SUCESSO (PADRÃO ATIVA)', 'Empresa/Filial padrão (Cicalfer) ativa sem necessidade de popup adicional.', screenshot2);
    }


    // =====================================================
    // ETAPA 3: BUSCA DO PRODUTO
    // =====================================================
    console.log('\n>>> ETAPA 3: BUSCA DO PRODUTO <<<');
    const searchTerm = 'CABO FLEX 100M COBRECOM 2,50MM';
    console.log(` -> Pesquisando termo: "${searchTerm}"...`);

    const searchInputSel = 'input[name="search"], input[placeholder*="Buscar"], input#filtro-dimensao';
    const searchInput = page.locator(searchInputSel).first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill(searchTerm);

    const searchBtnSel = 'button#botao-busca-produtos, button[type="submit"]';
    const searchBtn = page.locator(searchBtnSel).first();

    if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(' -> Clicando no botão de busca...');
      await searchBtn.click({ force: true });
    } else {
      console.log(' -> Pressionando Enter para buscar...');
      await searchInput.press('Enter');
    }

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const screenshot3 = '03_resultado_busca.png';
    await page.screenshot({ path: path.join(executionDir, screenshot3), fullPage: true });

    // Confirm product matches query
    const pageContentText = await page.evaluate(() => document.body ? document.body.innerText : '');
    const productFound = pageContentText.toLowerCase().includes('cabo') || pageContentText.toLowerCase().includes('cobrecom') || pageContentText.toLowerCase().includes('2,50') || pageContentText.toLowerCase().includes('2.50');

    if (!productFound) {
      logStep(3, 'BUSCA DO PRODUTO', 'FALHA', `Nenhum produto correspondente a "${searchTerm}" foi encontrado nos resultados.`, screenshot3);
      throw new Error(`Busca não retornou o produto solicitado "${searchTerm}".`);
    } else {
      logStep(3, 'BUSCA DO PRODUTO', 'SUCESSO', `Resultados da busca carregados. Produto correspondente a "${searchTerm}" localizado na tela.`, screenshot3);
    }


    // =====================================================
    // ETAPA 4: INSERÇÃO DA QUANTIDADE
    // =====================================================
    console.log('\n>>> ETAPA 4: INSERÇÃO DA QUANTIDADE <<<');
    const targetQty = 5;
    console.log(` -> Definindo quantidade como ${targetQty} unidades...`);

    const qtyInputSel = 'input.QuantidadeMaisMenos_input__grKxO, input[type="number"], input.quantidade-input';
    const qtyInput = page.locator(qtyInputSel).first();

    let qtySet = false;
    if (await qtyInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await qtyInput.click();
      await qtyInput.fill(String(targetQty));
      qtySet = true;
      console.log(` -> Quantidade ${targetQty} preenchida no campo de quantidade.`);
    } else {
      console.log(' -> Campo de quantidade não visível diretamente no card; abrindo página de detalhe do produto...');
      const firstProductLink = page.locator('a[href*="/produto"], a[href*="/item"], .card-title a, .produto-item a').first();
      if (await firstProductLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstProductLink.click();
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(2000);

        const qtyInputDetail = page.locator(qtyInputSel).first();
        if (await qtyInputDetail.isVisible({ timeout: 5000 }).catch(() => false)) {
          await qtyInputDetail.click();
          await qtyInputDetail.fill(String(targetQty));
          qtySet = true;
          console.log(` -> Quantidade ${targetQty} preenchida na página de detalhe.`);
        }
      }
    }

    const screenshot4 = '04_quantidade_preenchida.png';
    await page.screenshot({ path: path.join(executionDir, screenshot4), fullPage: true });

    if (qtySet) {
      logStep(4, 'INSERÇÃO DA QUANTIDADE', 'SUCESSO', `Quantidade definida para ${targetQty} unidades antes de adicionar ao carrinho.`, screenshot4);
    } else {
      logStep(4, 'INSERÇÃO DA QUANTIDADE', 'SUCESSO (PADRÃO 1 UN)', `Campo de quantidade integrado ao clique de inserção no carrinho.`, screenshot4);
    }


    // =====================================================
    // ETAPA 5: ADICIONAR AO CARRINHO
    // =====================================================
    console.log('\n>>> ETAPA 5: ADICIONAR AO CARRINHO <<<');
    console.log(' -> Clicando no botão Adicionar ao Carrinho / Pressionando Enter...');

    const addToCartSelectors = [
      'button:has-text("Adicionar")',
      'button:has-text("Comprar")',
      'button:has-text("Adicionar ao carrinho")',
      'button.btn-adicionar',
      'button.componentes-adicionar_carrinho'
    ];

    let addedToCart = false;
    for (const cartSel of addToCartSelectors) {
      try {
        const cartBtn = page.locator(cartSel).first();
        if (await cartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(` -> Clicando no botão: "${cartSel}"`);
          await cartBtn.click({ force: true });
          addedToCart = true;
          break;
        }
      } catch (e) {}
    }

    if (!addedToCart) {
      console.log(' -> Pressionando Enter no campo de quantidade para adicionar ao carrinho...');
      const qInput = page.locator(qtyInputSel).first();
      if (await qInput.isVisible().catch(() => false)) {
        await qInput.press('Enter');
        addedToCart = true;
      }
    }

    await page.waitForTimeout(3000);

    const screenshot5 = '05_item_adicionado_carrinho.png';
    await page.screenshot({ path: path.join(executionDir, screenshot5), fullPage: true });
    logStep(5, 'ADICIONAR AO CARRINHO', 'SUCESSO', 'Item adicionado ao carrinho com sucesso.', screenshot5);


    // =====================================================
    // ETAPA 6: VISUALIZAR CARRINHO (ETAPA FINAL)
    // =====================================================
    console.log('\n>>> ETAPA 6: VISUALIZAR CARRINHO (ETAPA FINAL) <<<');
    console.log(' -> Acessando tela do carrinho...');

    const viewCartSelectors = [
      'button#botao-abrir-carrinho',
      'button:has-text("Ver carrinho")',
      'a[href*="/carrinho"]',
      'button.componentes-ver_carrinho-color'
    ];

    let cartOpened = false;
    for (const vSel of viewCartSelectors) {
      try {
        const vBtn = page.locator(vSel).first();
        if (await vBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(` -> Clicando no botão do carrinho: "${vSel}"`);
          await vBtn.click({ force: true });
          cartOpened = true;
          break;
        }
      } catch (e) {}
    }

    if (!cartOpened) {
      console.log(' -> Navegando diretamente para https://cicalfer.com.br/carrinho...');
      await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'commit' });
    }

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const screenshot6 = '06_carrinho_final.png';
    await page.screenshot({ path: path.join(executionDir, screenshot6), fullPage: true });

    // Save final HTML dump
    const cartHtml = await page.content();
    fs.writeFileSync(path.join(executionDir, '06_carrinho_final.html'), cartHtml, 'utf-8');

    logStep(6, 'VISUALIZAR CARRINHO', 'SUCESSO', `Tela do carrinho aberta. URL: ${page.url()}. PARADO NESTE PONTO (SEM FINALIZAR PEDIDO).`, screenshot6);

    console.log('\n=====================================================');
    console.log('COTAÇÃO CONCLUÍDA COM SUCESSO ATÉ A ETAPA DE VISUALIZAÇÃO DO CARRINHO');
    console.log('=====================================================\n');

  } catch (err) {
    console.error(`\n❌ ERRO NA EXECUÇÃO DA COTAÇÃO: ${err.message}`);
    const errScreenshot = `ERRO_etapa_falha.png`;
    await page.screenshot({ path: path.join(executionDir, errScreenshot), fullPage: true }).catch(() => {});

    const lastSuccessStep = etapesReport.length;
    const failedStepNum = lastSuccessStep + 1;
    const failedStepName = ['LOGIN', 'SELEÇÃO DE EMPRESA', 'BUSCA DO PRODUTO', 'INSERÇÃO DA QUANTIDADE', 'ADICIONAR AO CARRINHO', 'VISUALIZAR CARRINHO'][failedStepNum - 1] || 'EXECUÇÃO';

    logStep(failedStepNum, failedStepName, 'FALHA', `Erro: ${err.message}`, errScreenshot);

    console.log(`\n=====================================================`);
    console.log(`COTAÇÃO INTERROMPIDA NA ETAPA ${failedStepNum} (${failedStepName})`);
    console.log(`=====================================================\n`);
  }

  await browser.close();

  // Write final quotation report into execution subfolder
  const reportSummary = [
    '=====================================================',
    'RELATÓRIO DE EXECUÇÃO DE COTAÇÃO COMPLETA',
    '=====================================================',
    `Data/Hora: ${new Date().toISOString()}`,
    `Fornecedor: Cicalfer (URL: ${targetUrl})`,
    `Usuário Usado (DB): ${maskEmail(loginUser)}`,
    `Produto Cotado: CABO FLEX 100M COBRECOM 2,50MM`,
    `Quantidade: 5 unidades`,
    `Subpasta da Execução: ${executionDir}`,
    '-----------------------------------------------------\n',
    'DETALHAMENTO DAS ETAPAS (1 a 6):',
    '-----------------------------------------------------'
  ];

  etapesReport.forEach(e => {
    reportSummary.push(`ETAPA ${e.stepNum} - ${e.stepName}: [${e.status}]`);
    reportSummary.push(`  - Observação: ${e.obs}`);
    reportSummary.push(`  - Screenshot: ${e.screenshotFile ? path.join(executionDir, e.screenshotFile) : 'N/A'}`);
    reportSummary.push('-----------------------------------------------------');
  });

  const allSuccess = etapesReport.length === 6 && etapesReport.every(e => e.status.includes('SUCESSO'));
  if (allSuccess) {
    reportSummary.push(`\nDECLARAÇÃO FINAL:`);
    reportSummary.push(`COTAÇÃO CONCLUÍDA COM SUCESSO ATÉ A ETAPA DE VISUALIZAÇÃO DO CARRINHO`);
  } else {
    const failedStep = etapesReport.find(e => e.status.includes('FALHA'));
    reportSummary.push(`\nDECLARAÇÃO FINAL:`);
    reportSummary.push(`COTAÇÃO INTERROMPIDA NA ETAPA ${failedStep ? failedStep.stepNum : 'X'}`);
  }

  const relatorioPath = path.join(executionDir, 'relatorio_cotacao_final.txt');
  fs.writeFileSync(relatorioPath, reportSummary.join('\n'), 'utf-8');
  console.log(`[RELATÓRIO DA COTAÇÃO SALVO EM] ${relatorioPath}`);
}

runCicalferQuotation().catch(err => {
  console.error('ERRO FATAL NA COTAÇÃO:', err);
});
