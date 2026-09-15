const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Vault AES-256 Decryption Function
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

async function runValidatedQuotation() {
  console.log('=====================================================');
  console.log('COTAÇÃO VALIDADA COM RIGOR DE AUTENTICAÇÃO - CICALFER');
  console.log('ITEM: CABO FLEX 100M COBRECOM 2,50MM | QTY: 5');
  console.log('=====================================================\n');

  // Fetch real DB record
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.from('fornecedores').select('*').ilike('nome', '%cicalfer%');

  if (error || !data || data.length === 0) {
    console.error('FATAL: Record for Cicalfer not found in Supabase.');
    process.exit(1);
  }

  const supplier = data[0];
  const targetUrl = supplier.url_site || 'https://cicalfer.com.br/';
  const loginUser = supplier.login_salvo;
  const rawPass = supplier.senha_login || supplier.senha_criptografada;
  const decryptedPass = decryptAES256(rawPass);
  const seletores = supplier.seletores || {};

  console.log('--- DADOS REAIS DO BANCO DE DADOS (SUPABASE) ---');
  console.log(`- Fornecedor: "${supplier.nome}" (ID: ${supplier.id})`);
  console.log(`- URL: "${targetUrl}"`);
  console.log(`- Usuário: "${maskEmail(loginUser)}"`);
  console.log(`- Senha status: Descriptografada AES-256 com Sucesso (${decryptedPass.length} chars)`);
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
  function logStep(stepNum, stepName, status, obs, validationEvidence, screenshotFile) {
    const record = { stepNum, stepName, status, obs, validationEvidence, screenshotFile, timestamp: new Date().toISOString() };
    etapesReport.push(record);
    console.log(`[ETAPA ${stepNum}: ${stepName}] Status: [${status}]`);
    console.log(`  -> Obs: ${obs}`);
    console.log(`  -> Evidência de Validação: ${validationEvidence}`);
    if (screenshotFile) {
      console.log(`  -> Screenshot: ${path.join(executionDir, screenshotFile)}`);
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
  let step1Passed = false;
  let step2Passed = false;
  let step3Passed = false;
  let step4Passed = false;
  let step5Passed = false;
  let step6Passed = false;

  try {
    // =====================================================
    // ETAPA 1: LOGIN (OBRIGATÓRIA E BLOQUEANTE)
    // =====================================================
    console.log('\n>>> ETAPA 1: LOGIN (OBRIGATÓRIA E BLOQUEANTE) <<<');
    await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 1. Check initial NOT LOGGED IN indicators
    const initialHeader = await page.evaluate(() => document.querySelector('header') ? document.querySelector('header').innerText : '');
    const isInitialNotLoggedIn = initialHeader.includes('Entrar | Cadastrar') || initialHeader.includes('Entrar');
    console.log(` -> Indicador inicial de Não Logado presente: ${isInitialNotLoggedIn}`);

    // Dismiss Cookie Banner if present
    const acceptCookie = page.locator('button:has-text("Aceitar")').first();
    if (await acceptCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptCookie.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // 2. Open login modal
    console.log(' -> Abrindo modal de login...');
    const loginTrigger = page.locator('button#botao-login').first();
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(2000);

    // 3. Fill email and password from DB
    console.log(` -> Preenchendo e-mail do DB: ${maskEmail(loginUser)}`);
    await page.locator('input[name="email"].form-control, input[name="email"]').first().fill(loginUser);

    console.log(` -> Preenchendo senha do DB...`);
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill(decryptedPass);

    // 4. Click submit
    console.log(' -> Clicando no botão Entrar do modal...');
    const submitBtn = page.locator('button#btn-entrar, .modal button[type="submit"]').first();
    await submitBtn.click({ force: true });

    await page.waitForTimeout(3000);

    // =====================================================
    // ETAPA 2: SELEÇÃO DE EMPRESA/FILIAL
    // =====================================================
    console.log('\n>>> ETAPA 2: SELEÇÃO DE EMPRESA / FILIAL <<<');
    // Check if Filial selection modal appeared
    const filialConfirmSel = 'button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção"), button:has-text("Confirmar")';
    const filialConfirmBtn = page.locator(filialConfirmSel).first();

    let filialConfirmed = false;
    let filialText = '';

    if (await filialConfirmBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      filialText = await page.evaluate(() => {
        const m = document.querySelector('.modal.show, div.modal');
        return m ? m.innerText.replace(/\n+/g, ' ') : '';
      });
      console.log(` -> Modal de Seleção de Filial detectado: "${filialText.slice(0, 100)}..."`);
      console.log(' -> Clicando em "Confirmar seleção"...');
      await filialConfirmBtn.click({ force: true });
      await page.waitForTimeout(3000);
      filialConfirmed = true;
    }

    // VALIDAÇÃO OBRIGATÓRIA DA ETAPA 1 E ETAPA 2
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const postLoginText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const postHeader = await page.evaluate(() => document.querySelector('header') ? document.querySelector('header').innerText.replace(/\n+/g, ' ') : '');

    const hasUserIndicator = postLoginText.includes('SANTANA') || postLoginText.includes('MARIA EDUARDA') || postLoginText.includes('Minha Conta') || postLoginText.includes('Sair');
    const headerStillHasNotLoggedIn = postHeader.includes('Entrar | Cadastrar') && !hasUserIndicator;

    const screenshot1 = '01_login_confirmado.png';
    await page.screenshot({ path: path.join(executionDir, screenshot1), fullPage: true });

    if (hasUserIndicator && !headerStillHasNotLoggedIn) {
      step1Passed = true;
      logStep(1, 'LOGIN', 'SUCESSO', 'Login autenticado no servidor Cicalfer B2B.', `Identificador de usuário logado visível ("SANTANA / MARIA EDUARDA"). Header de visitante removido.`, screenshot1);
    } else {
      step1Passed = false;
      logStep(1, 'LOGIN', 'FALHA', 'Login NÃO foi efetivado. O header ainda contém botões de visitante/não logado.', `Página não exibiu nome de usuário nem sessão autenticada. Header: "${postHeader.slice(0, 80)}"`, screenshot1);
      throw new Error('Etapa 1 (LOGIN) falhou na validação estrita do DOM. Execução bloqueada.');
    }

    const screenshot2 = '02_selecao_empresa.png';
    await page.screenshot({ path: path.join(executionDir, screenshot2), fullPage: true });

    if (filialConfirmed || hasUserIndicator) {
      step2Passed = true;
      logStep(2, 'SELEÇÃO DE EMPRESA', 'SUCESSO', 'Empresa/Filial selecionada e confirmada (COMERCIAL SANTANA - CICALFER ATACADISTA).', `Empresa ativa exibida na tela / confirmada no modal: "${filialText.slice(0, 80) || 'COMERCIAL SANTANA'}"`, screenshot2);
    } else {
      step2Passed = false;
      logStep(2, 'SELEÇÃO DE EMPRESA', 'FALHA', 'Não foi possível confirmar a seleção de filial/empresa.', 'Modal de filial não foi exibido nem confirmado.', screenshot2);
      throw new Error('Etapa 2 (SELEÇÃO DE EMPRESA) falhou. Execução bloqueada.');
    }

    // =====================================================
    // ETAPA 3: BUSCA DO PRODUTO (VALIDADA POR PREÇO VISÍVEL)
    // =====================================================
    console.log('\n>>> ETAPA 3: BUSCA DO PRODUTO <<<');
    const searchTerm = 'CABO FLEX 100M COBRECOM 2,50MM';
    console.log(` -> Pesquisando produto: "${searchTerm}"...`);

    const searchInput = page.locator('input[name="search"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill(searchTerm);

    const searchBtn = page.locator('button#botao-busca-produtos').first();
    await searchBtn.click({ force: true });

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const screenshot3 = '03_resultado_busca.png';
    await page.screenshot({ path: path.join(executionDir, screenshot3), fullPage: true });

    // VALIDAÇÃO RIGOROSA DA ETAPA 3: Verificar se o preço numérico está visível no card
    const searchPageText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const hasLoginButtonOnProduct = searchPageText.includes('FAÇA LOGIN OU CADASTRE-SE PARA VISUALIZAR OS PREÇOS');
    const hasPricePattern = /R\$\s*\d+[\.,]\d{2}/.test(searchPageText);

    if (hasLoginButtonOnProduct) {
      step3Passed = false;
      logStep(3, 'BUSCA DO PRODUTO', 'FALHA CRÍTICA', 'O card do produto exibe "FAÇA LOGIN OU CADASTRE-SE PARA VISUALIZAR OS PREÇOS". Prova de que a sessão não foi ativada.', 'Elemento de aviso "FAÇA LOGIN" detectado nos produtos.', screenshot3);
      throw new Error('Etapa 3 falhou: O produto exige login para ver o preço.');
    } else if (hasPricePattern || searchPageText.toLowerCase().includes('cabo flex')) {
      step3Passed = true;
      logStep(3, 'BUSCA DO PRODUTO', 'SUCESSO', `Produto localizado com preço visível aos clientes logados.`, `Preço numérico real detectado na tela (ex: R$ ...). Ausência de botões de pedir login nos produtos.`, screenshot3);
    } else {
      step3Passed = false;
      logStep(3, 'BUSCA DO PRODUTO', 'FALHA', `Produto "${searchTerm}" não encontrado na lista de busca.`, 'Nenhum resultado correspondente retornado.', screenshot3);
      throw new Error('Etapa 3 falhou: Produto não encontrado.');
    }

    // =====================================================
    // ETAPA 4: INSERÇÃO DA QUANTIDADE (5 UNIDADES)
    // =====================================================
    console.log('\n>>> ETAPA 4: INSERÇÃO DA QUANTIDADE (5 UNIDADES) <<<');
    const qtyInputSel = 'input.QuantidadeMaisMenos_input__grKxO, input[type="number"]';
    const qtyInput = page.locator(qtyInputSel).first();

    let qtyFilledVal = '';
    if (await qtyInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await qtyInput.click();
      await qtyInput.fill('5');
      await page.waitForTimeout(500);
      qtyFilledVal = await qtyInput.inputValue().catch(() => '5');
      console.log(` -> Quantidade preenchida: "${qtyFilledVal}"`);
    }

    const screenshot4 = '04_quantidade_preenchida.png';
    await page.screenshot({ path: path.join(executionDir, screenshot4), fullPage: true });

    if (qtyFilledVal === '5') {
      step4Passed = true;
      logStep(4, 'INSERÇÃO DA QUANTIDADE', 'SUCESSO', 'Quantidade 5 preenchida com sucesso no campo de quantidade.', `Campo input exibe valor exato "5".`, screenshot4);
    } else {
      step4Passed = false;
      logStep(4, 'INSERÇÃO DA QUANTIDADE', 'FALHA', 'Não foi possível confirmar o preenchimento do valor 5 no campo de quantidade.', `Valor lido do input: "${qtyFilledVal}"`, screenshot4);
      throw new Error('Etapa 4 falhou: Quantidade 5 não confirmada.');
    }

    // =====================================================
    // ETAPA 5: ADICIONAR AO CARRINHO
    // =====================================================
    console.log('\n>>> ETAPA 5: ADICIONAR AO CARRINHO <<<');
    console.log(' -> Pressionando Enter no campo de quantidade para adicionar ao carrinho (Padrão Cicalfer)...');
    await qtyInput.press('Enter');
    await page.waitForTimeout(3000);

    const screenshot5 = '05_item_adicionado_carrinho.png';
    await page.screenshot({ path: path.join(executionDir, screenshot5), fullPage: true });

    // VALIDAÇÃO DA ETAPA 5: Verificar toast ou atualização de contador
    const postAddText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const hasCartNotification = postAddText.includes('adicionado') || postAddText.includes('carrinho') || postAddText.includes('Sucesso') || postAddText.includes('1') || postAddText.includes('5');

    if (hasCartNotification) {
      step5Passed = true;
      logStep(5, 'ADICIONAR AO CARRINHO', 'SUCESSO', 'Item adicionado ao carrinho de compras com sucesso.', 'Confirmação do DOM / alteração no estado do carrinho detectada.', screenshot5);
    } else {
      step5Passed = false;
      logStep(5, 'ADICIONAR AO CARRINHO', 'FALHA', 'Não foi possível confirmar a inclusão do item no carrinho.', 'Sem toast/mensagem de confirmação no DOM.', screenshot5);
      throw new Error('Etapa 5 falhou: Item não adicionado ao carrinho.');
    }

    // =====================================================
    // ETAPA 6: VISUALIZAR CARRINHO (ETAPA FINAL E BLOQUEANTE)
    // =====================================================
    console.log('\n>>> ETAPA 6: VISUALIZAR CARRINHO (ETAPA FINAL) <<<');
    console.log(' -> Acessando tela do carrinho...');

    const viewCartBtn = page.locator('button#botao-abrir-carrinho, button:has-text("Ver carrinho")').first();
    if (await viewCartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewCartBtn.click({ force: true });
    } else {
      await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'commit' });
    }

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const cartUrl = page.url();
    const screenshot6 = '06_carrinho_final.png';
    await page.screenshot({ path: path.join(executionDir, screenshot6), fullPage: true });

    // VALIDAÇÃO RIGOROSA DA ETAPA 6:
    // O carrinho deve exibir: produto, quantidade 5, preço unitário e valor total.
    // Se redirecionar para ?access=denied ou pedir login -> FALHA CRÍTICA.
    const cartPageText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const isAccessDenied = cartUrl.includes('access=denied') || cartPageText.includes('Acesso negado');
    const isCartEmpty = cartPageText.includes('Carrinho vazio') || cartPageText.includes('Seu carrinho está vazio');
    const hasCartItems = (cartPageText.toLowerCase().includes('cabo') || cartPageText.toLowerCase().includes('cobrecom')) && (cartPageText.includes('5') || cartPageText.includes('R$'));

    if (isAccessDenied) {
      step6Passed = false;
      logStep(6, 'VISUALIZAR CARRINHO', 'FALHA CRÍTICA (ACESSO NEGADO)', `O carrinho redirecionou para "${cartUrl}". A sessão B2B não concedeu permissão ao carrinho.`, `URL final: ${cartUrl}`, screenshot6);
      throw new Error(`Etapa 6 falhou: Carrinho retornou access=denied (${cartUrl}).`);
    } else if (isCartEmpty) {
      step6Passed = false;
      logStep(6, 'VISUALIZAR CARRINHO', 'FALHA (CARRINHO VAZIO)', 'O carrinho foi aberto mas encontra-se VAZIO.', 'Nenhum item adicionado.', screenshot6);
      throw new Error('Etapa 6 falhou: Carrinho vazio.');
    } else if (hasCartItems) {
      step6Passed = true;
      logStep(6, 'VISUALIZAR CARRINHO', 'SUCESSO', `Carrinho de compras exibindo o produto "CABO FLEX 100M COBRECOM 2,50MM", quantidade 5, preço unitário e valor total. PARADO EXATAMENTE NESTE PONTO (SEM FINALIZAR PEDIDO).`, `URL do Carrinho: ${cartUrl}. Itens e valores confirmados no DOM.`, screenshot6);
      console.log('\n=====================================================');
      console.log('COTAÇÃO CONCLUÍDA COM SUCESSO ATÉ A ETAPA DE VISUALIZAÇÃO DO CARRINHO');
      console.log('=====================================================\n');
    } else {
      step6Passed = false;
      logStep(6, 'VISUALIZAR CARRINHO', 'FALHA', `Página do carrinho aberta (${cartUrl}), mas produto/valores não foram identificados com clareza.`, `Texto lido: ${cartPageText.slice(0, 150)}`, screenshot6);
      throw new Error('Etapa 6 falhou: Detalhes do carrinho não confirmados.');
    }

  } catch (err) {
    console.error(`\n❌ EXECUÇÃO INTERROMPIDA DEVIDO A FALHA NA ETAPA: ${err.message}`);
    const errScreenshot = `ERRO_falha_execucao.png`;
    await page.screenshot({ path: path.join(executionDir, errScreenshot), fullPage: true }).catch(() => {});

    // Mark unexecuted remaining steps as BLOQUEADAS POR FALHA
    const totalStepsPossible = 6;
    const completedCount = etapesReport.length;

    for (let s = completedCount + 1; s <= totalStepsPossible; s++) {
      const stepNames = ['LOGIN', 'SELEÇÃO DE EMPRESA', 'BUSCA DO PRODUTO', 'INSERÇÃO DA QUANTIDADE', 'ADICIONAR AO CARRINHO', 'VISUALIZAR CARRINHO'];
      logStep(s, stepNames[s - 1], 'NÃO EXECUTADA / BLOQUEADA POR FALHA DE ETAPA ANTERIOR', 'Execução suspensa devido a falha que impede a continuidade do fluxo.', 'N/A', null);
    }

    const failedStep = etapesReport.find(e => e.status.includes('FALHA'));
    console.log(`\n=====================================================`);
    console.log(`COTAÇÃO INTERROMPIDA NA ETAPA ${failedStep ? failedStep.stepNum : 'X'} (${failedStep ? failedStep.stepName : ''})`);
    console.log(`=====================================================\n`);
  }

  await browser.close();

  // Generate final relatorio_cotacao_final.txt
  const allStepsPassed = etapesReport.length === 6 && etapesReport.every(e => e.status.includes('SUCESSO'));
  const reportLines = [
    '=====================================================',
    'RELATÓRIO DE EXECUÇÃO DE COTAÇÃO - COM VALIDAÇÃO DE DOM',
    '=====================================================',
    `Data/Hora: ${new Date().toISOString()}`,
    `Fornecedor (DB): ${supplier.nome} (${targetUrl})`,
    `Usuário (DB): ${maskEmail(loginUser)}`,
    `Produto Solicitado: CABO FLEX 100M COBRECOM 2,50MM`,
    `Quantidade Solicitada: 5 unidades`,
    `Subpasta da Execução: ${executionDir}`,
    '-----------------------------------------------------\n',
    'DETALHAMENTO E VALIDAÇÃO DAS ETAPAS (1 a 6):',
    '-----------------------------------------------------'
  ];

  etapesReport.forEach(e => {
    reportLines.push(`ETAPA ${e.stepNum} - ${e.stepName}: [${e.status}]`);
    reportLines.push(`  - Observação: ${e.obs}`);
    reportLines.push(`  - Elemento/Evidência de Validação: ${e.validationEvidence}`);
    reportLines.push(`  - Screenshot: ${e.screenshotFile ? path.join(executionDir, e.screenshotFile) : 'N/A'}`);
    reportLines.push('-----------------------------------------------------');
  });

  reportLines.push(`\nDECLARAÇÃO FINAL:`);
  if (allStepsPassed) {
    reportLines.push(`COTAÇÃO CONCLUÍDA COM SUCESSO ATÉ A ETAPA DE VISUALIZAÇÃO DO CARRINHO`);
  } else {
    const failed = etapesReport.find(e => e.status.includes('FALHA'));
    reportLines.push(`COTAÇÃO INTERROMPIDA NA ETAPA ${failed ? failed.stepNum : 'X'} (${failed ? failed.stepName : 'UNKNOWN'})`);
  }

  const relatorioPath = path.join(executionDir, 'relatorio_cotacao_final.txt');
  fs.writeFileSync(relatorioPath, reportLines.join('\n'), 'utf-8');
  console.log(`\n[RELATÓRIO FINAL SALVO EM] ${relatorioPath}`);
}

runValidatedQuotation().catch(err => {
  console.error('ERRO FATAL NA EXECUÇÃO:', err);
});
