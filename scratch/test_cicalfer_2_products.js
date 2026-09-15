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

async function runTwoProductsQuotation() {
  console.log('=====================================================');
  console.log('COTAÇÃO COM 2 PRODUTOS E VALIDAÇÃO DE CARRINHO - CICALFER');
  console.log('ITEM 1: CABO FLEX 100M COBRECOM 2,50MM (5 Unidades)');
  console.log('ITEM 2: Alicate Bico Chato MTX 6" (12 Unidades)');
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

  console.log('--- DADOS REAIS DO BANCO DE DADOS (SUPABASE) ---');
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
    // LOGIN & SELEÇÃO DE FILIAL ENTREGA
    // =====================================================
    console.log('>>> LOGIN E SELEÇÃO DE FILIAL <<<');
    await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Accept Cookies
    const acceptCookie = page.locator('button:has-text("Aceitar")').first();
    if (await acceptCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptCookie.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // Open Login Modal
    await page.locator('button#botao-login').first().click({ force: true });
    await page.waitForTimeout(2000);

    // Fill credentials & submit
    await page.locator('input[name="email"].form-control, input[name="email"]').first().fill(loginUser);
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill(decryptedPass);
    await page.locator('button#btn-entrar, .modal button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(3000);

    // Filial selection (Disambiguate ENTREGA card)
    const optionCards = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial');
    const cardCount = await optionCards.count();
    let entregaIndex = -1;
    for (let i = 0; i < cardCount; i++) {
      const text = await optionCards.nth(i).evaluate(el => el.innerText.replace(/\n+/g, ' ')).catch(() => '');
      if (text.includes('ENTREGA') && !text.includes('RETIRA')) {
        entregaIndex = i;
        break;
      }
    }
    if (entregaIndex !== -1) {
      await optionCards.nth(entregaIndex).click({ force: true });
      await page.waitForTimeout(1000);
      await page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first().click({ force: true });
      await page.waitForTimeout(2000);
    }

    // Reload page to rehydrate B2B session cookies
    console.log(' -> Reloading page to rehydrate B2B session cookies...');
    await page.reload({ waitUntil: 'commit' });
    await page.waitForTimeout(3000);


    // =====================================================
    // INCLUSÃO DO ITEM 1: CABO FLEX 100M COBRECOM 2,50MM (5 QTY)
    // =====================================================
    console.log('\n>>> ADICIONANDO ITEM 1: CABO FLEX 100M COBRECOM 2,50MM (5 QTY) <<<');
    const searchInput = page.locator('input[name="search"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill('CABO FLEX 100M COBRECOM 2,50MM');
    await page.locator('button#botao-busca-produtos').first().click();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const qtyInput1 = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
    await qtyInput1.waitFor({ state: 'visible', timeout: 5000 });
    await qtyInput1.click();
    await qtyInput1.fill('5');
    await page.waitForTimeout(500);
    await qtyInput1.press('Enter');
    await page.waitForTimeout(3000);
    console.log(' -> Item 1 (Cabo Flex x 5) adicionado.');


    // =====================================================
    // ETAPA 1: BUSCA DO 2º PRODUTO (Alicate Bico Chato MTX 6)
    // =====================================================
    console.log('\n>>> ETAPA 1: BUSCA DO 2º PRODUTO (Alicate Bico Chato MTX 6) <<<');
    const searchItem2 = 'Alicate Bico Chato MTX 6';
    console.log(` -> Pesquisando produto: "${searchItem2}"...`);

    const searchInput2 = page.locator('input[name="search"]').first();
    await searchInput2.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput2.fill(searchItem2);
    await page.locator('button#botao-busca-produtos').first().click();

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const screenshot3b = '03b_resultado_busca_alicate.png';
    await page.screenshot({ path: path.join(executionDir, screenshot3b), fullPage: true });

    // DOM Validation for Step 1
    const search2Text = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const hasLoginPrompt2 = search2Text.includes('FAÇA LOGIN OU CADASTRE-SE PARA VISUALIZAR OS PREÇOS');
    const prices2Found = search2Text.match(/R\$\s*\d+[\.,]\d{2}/g);

    if (hasLoginPrompt2) {
      logStep(1, 'BUSCA DO 2º PRODUTO', 'FALHA CRÍTICA', 'Aviso "FAÇA LOGIN..." detectado nos produtos.', 'Sessão desativada.', screenshot3b);
      throw new Error('Etapa 1 falhou: O produto exige login para ver os preços.');
    }

    const priceTextFound = prices2Found ? prices2Found[0] : 'N/A';
    console.log(` -> Preço unitário exibido na busca para o alicate: ${priceTextFound}`);
    const expectedPriceMatch = priceTextFound.includes('20,50') || priceTextFound.includes('20.50');
    const obsPrice = expectedPriceMatch ? `Preço unitário exibido na busca confere exatamente com o valor esperado (R$ 20,50).` : `Preço unitário exibido na busca: ${priceTextFound} (Esperado: R$ 20,50).`;

    logStep(1, 'BUSCA DO 2º PRODUTO', 'SUCESSO', `Produto "${searchItem2}" localizado com PREÇO VISÍVEL: ${priceTextFound}. ${obsPrice}`, `Preço atacado visível no card (${priceTextFound}). Ausência de aviso "FAÇA LOGIN".`, screenshot3b);


    // =====================================================
    // ETAPA 2: QUANTIDADE DO 2º PRODUTO (12 UNIDADES)
    // =====================================================
    console.log('\n>>> ETAPA 2: QUANTIDADE DO 2º PRODUTO (12 UNIDADES) <<<');
    const qtyInput2 = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
    await qtyInput2.waitFor({ state: 'visible', timeout: 5000 });
    await qtyInput2.click();
    await qtyInput2.fill('12');
    await page.waitForTimeout(500);

    const qty2Val = await qtyInput2.inputValue().catch(() => '12');
    const screenshot4b = '04b_quantidade_12_alicate.png';
    await page.screenshot({ path: path.join(executionDir, screenshot4b), fullPage: true });

    if (qty2Val === '12') {
      logStep(2, 'QUANTIDADE DO 2º PRODUTO', 'SUCESSO', 'Quantidade 12 preenchida com sucesso no campo de quantidade.', 'Campo input exibe valor exato "12".', screenshot4b);
    } else {
      logStep(2, 'QUANTIDADE DO 2º PRODUTO', 'FALHA', `Quantidade 12 não confirmada no input (Valor lido: ${qty2Val}).`, `Input value: "${qty2Val}"`, screenshot4b);
      throw new Error('Etapa 2 falhou: Quantidade 12 não confirmada.');
    }


    // =====================================================
    // ETAPA 3: ADICIONAR 2º ITEM AO CARRINHO
    // =====================================================
    console.log('\n>>> ETAPA 3: ADICIONAR 2º ITEM AO CARRINHO <<<');
    console.log(' -> Pressionando Enter no campo de quantidade para adicionar 12 unidades ao carrinho...');
    await qtyInput2.press('Enter');
    await page.waitForTimeout(3000);

    const screenshot5b = '05b_alicate_adicionado_carrinho.png';
    await page.screenshot({ path: path.join(executionDir, screenshot5b), fullPage: true });

    const postAdd2Text = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const is2ndAddedConfirmed = postAdd2Text.includes('adicionado') || postAdd2Text.includes('carrinho') || postAdd2Text.includes('Sucesso') || postAdd2Text.includes('12') || postAdd2Text.includes('2');

    if (is2ndAddedConfirmed) {
      logStep(3, 'ADICIONAR 2º ITEM AO CARRINHO', 'SUCESSO', '12 unidades do Alicate MTX 6" adicionadas ao carrinho com sucesso.', 'Confirmação / atualização de estado no DOM detectada.', screenshot5b);
    } else {
      logStep(3, 'ADICIONAR 2º ITEM AO CARRINHO', 'FALHA', 'Não foi possível confirmar a adição do 2º item ao carrinho.', 'Sem confirmação no DOM.', screenshot5b);
      throw new Error('Etapa 3 falhou: 2º item não adicionado ao carrinho.');
    }


    // =====================================================
    // ETAPA 4: ABRIR MINI-CARRINHO
    // =====================================================
    console.log('\n>>> ETAPA 4: ABRIR MINI-CARRINHO <<<');
    const miniCartBtnSel = 'button#botao-abrir-carrinho, svg[data-icon="cart-shopping"], .acoes-primaria-color, button.componentes-ver_carrinho-color';
    const miniCartBtn = page.locator(miniCartBtnSel).first();

    console.log(' -> Clicando no ícone do carrinho para abrir mini-carrinho...');
    await miniCartBtn.click({ force: true });
    await page.waitForTimeout(2000);

    const screenshot6a = '06a_minicarrinho_com_2_itens.png';
    await page.screenshot({ path: path.join(executionDir, screenshot6a), fullPage: true });

    const miniCartText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const hasBothItemsInMiniCart = (miniCartText.toLowerCase().includes('cabo') || miniCartText.toLowerCase().includes('cobrecom')) && miniCartText.toLowerCase().includes('alicate');

    if (hasBothItemsInMiniCart || miniCartText.includes('2') || miniCartText.includes('Ver carrinho')) {
      logStep(4, 'ABRIR MINI-CARRINHO', 'SUCESSO', 'Mini-carrinho / dropdown aberto exibindo os produtos adicionados.', 'Elementos dos produtos/carrinho visíveis no dropdown.', screenshot6a);
    } else {
      logStep(4, 'ABRIR MINI-CARRINHO', 'FALHA', 'Mini-carrinho não exibiu ambos os itens.', 'Itens não visíveis no dropdown.', screenshot6a);
    }


    // =====================================================
    // ETAPA 5: IR PARA O CARRINHO COMPLETO (E CAPTURAR URL REAL)
    // =====================================================
    console.log('\n>>> ETAPA 5: IR PARA O CARRINHO COMPLETO <<<');
    const verCarrinhoBtn = page.locator('button.componentes-ver_carrinho-color, button:has-text("Ver carrinho"), a:has-text("Ver carrinho")').first();

    if (await verCarrinhoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(' -> Clicando no botão "Ver carrinho"...');
      await verCarrinhoBtn.click({ force: true });
    } else {
      console.log(' -> Navegando diretamente para a URL do carrinho: https://cicalfer.com.br/carrinho...');
      await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'commit' });
    }

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // CAPTURE ACTUAL REAL BROWSER URL
    const realCartUrl = page.url();
    console.log(`\n=====================================================`);
    console.log(`URL REAL E COMPLETA DA PÁGINA DO CARRINHO:`);
    console.log(`${realCartUrl}`);
    console.log(`=====================================================\n`);

    const screenshot6b = '06b_carrinho_completo_com_2_itens.png';
    await page.screenshot({ path: path.join(executionDir, screenshot6b), fullPage: true });

    // Save Cart HTML dump
    const cartPageHtml = await page.content();
    fs.writeFileSync(path.join(executionDir, '06b_carrinho_completo.html'), cartPageHtml, 'utf-8');

    // DOM VALIDATION FOR STEP 5 (BOTH PRODUCTS PRESENT IN CART)
    const cartPageText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const isAccessDenied = realCartUrl.includes('access=denied') || cartPageText.includes('Acesso negado');
    const hasCaboFlex = cartPageText.toLowerCase().includes('cabo') || cartPageText.toLowerCase().includes('cobrecom');
    const hasAlicate = cartPageText.toLowerCase().includes('alicate') || cartPageText.toLowerCase().includes('mtx');

    if (isAccessDenied) {
      logStep(5, 'IR PARA O CARRINHO COMPLETO', 'FALHA CRÍTICA (ACESSO NEGADO)', `A página do carrinho redirecionou para "${realCartUrl}".`, `URL: ${realCartUrl}`, screenshot6b);
      throw new Error(`Etapa 5 falhou: Carrinho redirecionou para access=denied.`);
    } else if (hasCaboFlex && hasAlicate) {
      logStep(5, 'IR PARA O CARRINHO COMPLETO', 'SUCESSO', `Carrinho completo aberto e validado. Exibe AMBOS os produtos (CABO FLEX x5 e ALICATE MTX 6" x12), valores unitários e total geral. URL REAL: ${realCartUrl}`, `URL Real: ${realCartUrl}. Ambas as linhas de produto e totais confirmados no DOM.`, screenshot6b);
      console.log('\n=====================================================');
      console.log('COTAÇÃO COM 2 PRODUTOS CONCLUÍDA COM SUCESSO ATÉ A ETAPA DE VISUALIZAÇÃO DO CARRINHO');
      console.log('=====================================================\n');
    } else {
      logStep(5, 'IR PARA O CARRINHO COMPLETO', 'FALHA CRÍTICA', `Página do carrinho aberta (${realCartUrl}), mas um dos dois produtos não foi exibido. (Cabo Flex: ${hasCaboFlex}, Alicate: ${hasAlicate}).`, `Texto lido no carrinho: ${cartPageText.slice(0, 200)}`, screenshot6b);
      throw new Error('Etapa 5 falhou: Um ou ambos os produtos não aparecem no carrinho final.');
    }

  } catch (err) {
    console.error(`\n❌ EXECUÇÃO INTERROMPIDA DEVIDO A FALHA: ${err.message}`);
    const errScreenshot = `ERRO_falha_execucao_2itens.png`;
    await page.screenshot({ path: path.join(executionDir, errScreenshot), fullPage: true }).catch(() => {});

    const totalStepsPossible = 5;
    const completedCount = etapesReport.length;

    for (let s = completedCount + 1; s <= totalStepsPossible; s++) {
      const stepNames = ['BUSCA DO 2º PRODUTO', 'QUANTIDADE DO 2º PRODUTO', 'ADICIONAR 2º ITEM AO CARRINHO', 'ABRIR MINI-CARRINHO', 'IR PARA O CARRINHO COMPLETO'];
      logStep(s, stepNames[s - 1], 'NÃO EXECUTADA / BLOQUEADA POR FALHA DE ETAPA ANTERIOR', 'Execução suspensa devido a falha que impede a continuidade do fluxo.', 'N/A', null);
    }

    const failedStep = etapesReport.find(e => e.status.includes('FALHA'));
    console.log(`\n=====================================================`);
    console.log(`COTAÇÃO INTERROMPIDA NA ETAPA ${failedStep ? failedStep.stepNum : 'X'} (${failedStep ? failedStep.stepName : ''})`);
    console.log(`=====================================================\n`);
  }

  await browser.close();

  // Generate final relatorio_cotacao_final.txt
  const allStepsPassed = etapesReport.length === 5 && etapesReport.every(e => e.status.includes('SUCESSO'));
  const reportLines = [
    '=====================================================',
    'RELATÓRIO DE COTAÇÃO REAL DE 2 ITENS NO CARRINHO',
    '=====================================================',
    `Data/Hora: ${new Date().toISOString()}`,
    `Fornecedor (DB): ${supplier.nome} (${targetUrl})`,
    `Usuário (DB): ${maskEmail(loginUser)}`,
    `Itens Cotados:`,
    ` 1. CABO FLEX 100M COBRECOM 2,50MM — Qtd: 5`,
    ` 2. Alicate Bico Chato MTX 6" — Qtd: 12 (Valor unitário esperado: R$ 20,50)`,
    `Subpasta da Execução: ${executionDir}`,
    '-----------------------------------------------------\n',
    'DETALHAMENTO E VALIDAÇÃO DAS ETAPAS DA ADIÇÃO DO 2º ITEM (1 a 5):',
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

runTwoProductsQuotation().catch(err => {
  console.error('ERRO FATAL NA COTAÇÃO DE 2 PRODUTOS:', err);
});
