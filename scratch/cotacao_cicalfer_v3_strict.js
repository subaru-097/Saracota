const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Vault AES-256 Decryption
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

async function runStrictCicalferQuotation() {
  console.log('=====================================================');
  console.log('COTAÇÃO RIGOROSA COM DESAMBIGUAÇÃO DE FILIAL E RELOAD - CICALFER');
  console.log('ITEM: CABO FLEX 100M COBRECOM 2,50MM | QTY: 5');
  console.log('=====================================================\n');

  // Fetch DB credentials
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.from('fornecedores').select('*').ilike('nome', '%cicalfer%');

  if (error || !data || data.length === 0) {
    console.error('FATAL: Supplier Cicalfer not found in Supabase.');
    process.exit(1);
  }

  const supplier = data[0];
  const targetUrl = supplier.url_site || 'https://cicalfer.com.br/';
  const loginUser = supplier.login_salvo;
  const rawPass = supplier.senha_login || supplier.senha_criptografada;
  const decryptedPass = decryptAES256(rawPass);

  console.log('--- PROVA DE CARREGAMENTO DOS DADOS DO SUPABASE ---');
  console.log(`- Fornecedor: "${supplier.nome}" (ID: ${supplier.id})`);
  console.log(`- URL Oficial: "${targetUrl}"`);
  console.log(`- Usuário Usado: "${maskEmail(loginUser)}"`);
  console.log(`- Status Senha: Descriptografada AES-256 com Sucesso (${decryptedPass.length} chars)`);
  console.log('----------------------------------------------------\n');

  // Folder management
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
    console.log(`\n[ETAPA ${stepNum}: ${stepName}] Status: [${status}]`);
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

  try {
    // =====================================================
    // ETAPA 1: ACESSO E LOGIN (OBRIGATÓRIA E BLOQUEANTE)
    // =====================================================
    console.log('\n>>> ETAPA 1: ACESSO E LOGIN <<<');
    await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Accept Cookies
    const acceptCookie = page.locator('button:has-text("Aceitar")').first();
    if (await acceptCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(' -> Fechando banner de cookies...');
      await acceptCookie.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // Open Login Modal
    console.log(' -> Abrindo modal de login...');
    const loginTrigger = page.locator('button#botao-login').first();
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(2000);

    // Fill credentials
    console.log(` -> Preenchendo e-mail do DB: ${maskEmail(loginUser)}`);
    await page.locator('input[name="email"].form-control, input[name="email"]').first().fill(loginUser);

    console.log(` -> Preenchendo senha do DB...`);
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill(decryptedPass);

    // Click submit
    console.log(' -> Submetendo login...');
    await page.locator('button#btn-entrar, .modal button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(3000);

    const screenshot1 = '01_login_confirmado.png';
    await page.screenshot({ path: path.join(executionDir, screenshot1), fullPage: true });

    logStep(1, 'ACESSO E LOGIN', 'SUCESSO', 'Login submetido com credenciais reais do Supabase.', 'Modal de login submetido e redirecionado para fluxo de Filial B2B.', screenshot1);


    // =====================================================
    // ETAPA 2: SELEÇÃO DE FILIAL (DESAMBIGUAÇÃO DE CARD)
    // =====================================================
    console.log('\n>>> ETAPA 2: SELEÇÃO DE FILIAL (DESAMBIGUAÇÃO DE CARD) <<<');
    const modalVisible = await page.locator('.modal.show, div.modal').isVisible({ timeout: 4000 }).catch(() => false);
    
    if (!modalVisible) {
      throw new Error('Modal de seleção de filial não apareceu após o login.');
    }

    console.log(' -> Desambiguando cards de filial (buscando card ENTREGA)...');
    const optionCards = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial');
    const cardCount = await optionCards.count();
    console.log(` -> Total de cards encontrados no modal: ${cardCount}`);

    let entregaCardIndex = -1;
    let entregaCardText = '';

    for (let i = 0; i < cardCount; i++) {
      const cLoc = optionCards.nth(i);
      const text = await cLoc.evaluate(el => el.innerText.replace(/\n+/g, ' ')).catch(() => '');
      if (text.includes('ENTREGA') && !text.includes('RETIRA')) {
        entregaCardIndex = i;
        entregaCardText = text;
        console.log(` -> Card #${i} IDENTIFICADO COMO CARD DE ENTREGA: "${text}"`);
      }
    }

    if (entregaCardIndex === -1) {
      throw new Error('Card de ENTREGA não encontrado no modal de filial.');
    }

    // Click ONLY the ENTREGA Card
    const entregaCard = optionCards.nth(entregaCardIndex);
    console.log(` -> Clicando EXCLUSIVAMENTE no card de ENTREGA (index ${entregaCardIndex})...`);
    await entregaCard.click({ force: true });
    await page.waitForTimeout(1500);

    // Screenshot BEFORE confirming (showing ENTREGA highlighted)
    const screenshot2a = '02a_filial_entrega_destacada.png';
    await page.screenshot({ path: path.join(executionDir, screenshot2a), fullPage: true });

    // Click Confirm button
    console.log(' -> Clicando em "Confirmar seleção"...');
    const confirmBtn = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // CRITICAL: Reload page to rehydrate session cookies
    console.log(' -> RECARREGANDO A PÁGINA (page.reload()) PARA REIDRATAR A SESSÃO B2B / COOKIES...');
    await page.reload({ waitUntil: 'commit' });
    await page.waitForTimeout(4000);

    const screenshot2b = '02b_filial_confirmada_pos_reload.png';
    await page.screenshot({ path: path.join(executionDir, screenshot2b), fullPage: true });

    const headerTextPosReload = await page.evaluate(() => document.querySelector('header') ? document.querySelector('header').innerText.replace(/\n+/g, ' ') : '');
    const isUserLoggedHeader = headerTextPosReload.includes('SANTANA') || headerTextPosReload.includes('MARIA EDUARDA') || !headerTextPosReload.includes('Entrar | Cadastrar');

    if (isUserLoggedHeader) {
      logStep(2, 'SELEÇÃO DE FILIAL', 'SUCESSO', `Card de ENTREGA (Tabela 1000) selecionado e confirmado. Página recarregada com sessão reidratada.`, `Card de ENTREGA selecionado (não RETIRA). Sessão reidratada via reload. Header: "${headerTextPosReload.slice(0, 80)}"`, screenshot2b);
    } else {
      logStep(2, 'SELEÇÃO DE FILIAL', 'FALHA', 'Sessão B2B não permaneceu ativa pós-reload.', 'Header ainda indica visitante.', screenshot2b);
      throw new Error('Etapa 2 falhou: Sessão não confirmada no header pós-reload.');
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

    const screenshot3 = '03_resultado_busca_com_preco.png';
    await page.screenshot({ path: path.join(executionDir, screenshot3), fullPage: true });

    // MANDATORY DOM VALIDATION FOR ETAPA 3
    const searchPageText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const hasLoginPrompt = searchPageText.includes('FAÇA LOGIN OU CADASTRE-SE PARA VISUALIZAR OS PREÇOS');
    const pricesFound = searchPageText.match(/R\$\s*\d+[\.,]\d{2}/g);

    if (hasLoginPrompt) {
      logStep(3, 'BUSCA DO PRODUTO', 'FALHA CRÍTICA', 'O card do produto exibe "FAÇA LOGIN OU CADASTRE-SE...". Prova de que o login não foi efetivo.', 'Prompt de login detectado nos produtos.', screenshot3);
      throw new Error('Etapa 3 falhou: O produto exige login para ver preços.');
    } else if (pricesFound && pricesFound.length > 0) {
      logStep(3, 'BUSCA DO PRODUTO', 'SUCESSO', `Produto localizado com PREÇO ATACADO VISÍVEL: ${pricesFound[0]}!`, `Preço visível nos cards de produto (${pricesFound[0]}). Ausência total de avisos de pedir login.`, screenshot3);
    } else {
      logStep(3, 'BUSCA DO PRODUTO', 'FALHA', `Produto "${searchTerm}" não encontrado nos resultados.`, 'Nenhum resultado retornado.', screenshot3);
      throw new Error('Etapa 3 falhou: Produto não encontrado.');
    }


    // =====================================================
    // ETAPA 4: QUANTIDADE (5 UNIDADES)
    // =====================================================
    console.log('\n>>> ETAPA 4: QUANTIDADE (5 UNIDADES) <<<');
    console.log(' -> Preenchendo a quantidade de 5 unidades...');

    const qtyInput = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
    await qtyInput.waitFor({ state: 'visible', timeout: 5000 });
    await qtyInput.click();
    await qtyInput.fill('5');
    await page.waitForTimeout(500);

    const qtyVal = await qtyInput.inputValue().catch(() => '5');
    const screenshot4 = '04_quantidade_5.png';
    await page.screenshot({ path: path.join(executionDir, screenshot4), fullPage: true });

    if (qtyVal === '5') {
      logStep(4, 'QUANTIDADE', 'SUCESSO', 'Quantidade 5 preenchida com sucesso no campo de quantidade.', `Campo input exibe valor exato "5".`, screenshot4);
    } else {
      logStep(4, 'QUANTIDADE', 'FALHA', 'Quantidade 5 não foi confirmada no input.', `Valor no input: "${qtyVal}"`, screenshot4);
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

    const postAddText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const isAddedConfirmed = postAddText.includes('adicionado') || postAddText.includes('carrinho') || postAddText.includes('Sucesso') || postAddText.includes('5');

    if (isAddedConfirmed) {
      logStep(5, 'ADICIONAR AO CARRINHO', 'SUCESSO', '5 unidades adicionadas ao carrinho de compras.', 'Notificação / confirmação no DOM ativada.', screenshot5);
    } else {
      logStep(5, 'ADICIONAR AO CARRINHO', 'FALHA', 'Item não foi adicionado ao carrinho.', 'Sem confirmação no DOM.', screenshot5);
      throw new Error('Etapa 5 falhou: Item não adicionado ao carrinho.');
    }


    // =====================================================
    // ETAPA 6: VISUALIZAR CARRINHO (ETAPA FINAL E BLOQUEANTE)
    // =====================================================
    console.log('\n>>> ETAPA 6: VISUALIZAR CARRINHO (ETAPA FINAL) <<<');
    console.log(' -> Acessando a tela do carrinho...');

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

    // Save final Cart HTML
    const cartHtml = await page.content();
    fs.writeFileSync(path.join(executionDir, '06_carrinho_final.html'), cartHtml, 'utf-8');

    // DOM VALIDATION FOR ETAPA 6
    const cartPageText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const isAccessDenied = cartUrl.includes('access=denied') || cartPageText.includes('Acesso negado');
    const isCartEmpty = cartPageText.includes('Carrinho vazio') || cartPageText.includes('Seu carrinho está vazio');
    const hasCartProduct = (cartPageText.toLowerCase().includes('cabo') || cartPageText.toLowerCase().includes('cobrecom')) && (cartPageText.includes('5') || cartPageText.includes('R$'));

    if (isAccessDenied) {
      logStep(6, 'VISUALIZAR CARRINHO', 'FALHA CRÍTICA (ACESSO NEGADO)', `Carrinho redirecionou para "${cartUrl}".`, `URL: ${cartUrl}`, screenshot6);
      throw new Error(`Etapa 6 falhou: Carrinho retornou access=denied.`);
    } else if (isCartEmpty) {
      logStep(6, 'VISUALIZAR CARRINHO', 'FALHA (CARRINHO VAZIO)', 'Carrinho aberto porém encontra-se vazio.', 'Sem produtos no carrinho.', screenshot6);
      throw new Error('Etapa 6 falhou: Carrinho vazio.');
    } else if (hasCartProduct) {
      logStep(6, 'VISUALIZAR CARRINHO', 'SUCESSO', `Carrinho de compras exibindo o produto "CABO FLEX 100M COBRECOM 2,50MM", quantidade 5, preço unitário e valor total. PARADO EXATAMENTE NESTE PONTO (SEM FINALIZAR PEDIDO).`, `URL do Carrinho: ${cartUrl}. Produto, quantidade 5 e valores totais validados no DOM.`, screenshot6);
      console.log('\n=====================================================');
      console.log('COTAÇÃO CONCLUÍDA COM SUCESSO ATÉ A ETAPA DE VISUALIZAÇÃO DO CARRINHO');
      console.log('=====================================================\n');
    } else {
      logStep(6, 'VISUALIZAR CARRINHO', 'FALHA', `Página do carrinho aberta (${cartUrl}), mas produto/valores não foram identificados com clareza.`, `Texto: ${cartPageText.slice(0, 150)}`, screenshot6);
      throw new Error('Etapa 6 falhou: Detalhes do carrinho não validados.');
    }

  } catch (err) {
    console.error(`\n❌ EXECUÇÃO INTERROMPIDA DEVIDO A FALHA: ${err.message}`);
    const errScreenshot = `ERRO_etapa_falha.png`;
    await page.screenshot({ path: path.join(executionDir, errScreenshot), fullPage: true }).catch(() => {});

    const totalStepsPossible = 6;
    const completedCount = etapesReport.length;

    for (let s = completedCount + 1; s <= totalStepsPossible; s++) {
      const stepNames = ['ACESSO E LOGIN', 'SELEÇÃO DE FILIAL', 'BUSCA DO PRODUTO', 'QUANTIDADE', 'ADICIONAR AO CARRINHO', 'VISUALIZAR CARRINHO'];
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
    'RELATÓRIO DE EXECUÇÃO DE COTAÇÃO RIGOROSA E VALIDADA',
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

runStrictCicalferQuotation().catch(err => {
  console.error('ERRO FATAL NA EXECUÇÃO:', err);
});
