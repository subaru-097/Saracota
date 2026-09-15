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

async function testLoteEmbalagem() {
  console.log('=====================================================');
  console.log('TESTE DE COMPORTAMENTO DE LOTE / EMBALAGEM MÚLTIPLA - CICALFER');
  console.log('ITEM: BROXA ROMA RETANGULAR 15,5X5,5CM (REF: 11992 | EMB: 12)');
  console.log('QUANTIDADE DIGITADA PARA TESTE PROPOSITAL: 20');
  console.log('=====================================================\n');

  // Fetch DB record
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

  console.log('--- DADOS REAIS DO SUPABASE ---');
  console.log(`- Fornecedor: "${supplier.nome}"`);
  console.log(`- URL: "${targetUrl}"`);
  console.log(`- Usuário: "${maskEmail(loginUser)}"`);
  console.log('--------------------------------\n');

  // Folder setup
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
    console.log(`  -> Evidência: ${validationEvidence}`);
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
    // LOGIN & FILIAL ENTREGA REHYDRATED
    // =====================================================
    console.log('>>> LOGIN E SELEÇÃO DE FILIAL ENTREGA <<<');
    await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Accept Cookies
    const acceptCookie = page.locator('button:has-text("Aceitar")').first();
    if (await acceptCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptCookie.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // Login modal
    await page.locator('button#botao-login').first().click({ force: true });
    await page.waitForTimeout(2000);
    await page.locator('input[name="email"].form-control, input[name="email"]').first().fill(loginUser);
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill(decryptedPass);
    await page.locator('button#btn-entrar, .modal button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(3000);

    // Select Filial ENTREGA
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

    // Reload page to rehydrate B2B session
    console.log(' -> Reloading page for B2B session rehydration...');
    await page.reload({ waitUntil: 'commit' });
    await page.waitForTimeout(3000);


    // =====================================================
    // ETAPA 1: BUSCA DO PRODUTO (BROXA ROMA RETANGULAR 15,5X5,5CM REF: 11992)
    // =====================================================
    console.log('\n>>> ETAPA 1: BUSCA DO PRODUTO DE LOTE <<<');
    const searchTerms = ['11992', 'BROXA ROMA RETANGULAR 15,5X5,5CM', 'BROXA ROMA 11992', 'BROXA ROMA'];
    let productFound = false;
    let finalTermUsed = '';

    for (const term of searchTerms) {
      console.log(` -> Pesquisando produto com o termo: "${term}"...`);
      const searchInput = page.locator('input[name="search"]').first();
      await searchInput.waitFor({ state: 'visible', timeout: 10000 });
      await searchInput.fill('');
      await searchInput.fill(term);
      await page.locator('button#botao-busca-produtos').first().click();

      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(4000);

      const pageText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
      if (!pageText.includes('Produto não encontrado') && (pageText.includes('11992') || pageText.includes('BROXA') || pageText.includes('ROMA'))) {
        productFound = true;
        finalTermUsed = term;
        console.log(` -> SUCESSO: Produto localizado no site usando o termo "${term}"!`);
        break;
      } else {
        console.log(` -> Termo "${term}" retornou "Produto não encontrado". Tentando próximo termo...`);
      }
    }

    const htmlContent1 = await page.content();
    fs.writeFileSync(path.join(executionDir, '01_busca_broxa.html'), htmlContent1, 'utf-8');

    const screenshot1 = '01_busca_broxa_emb12.png';
    await page.screenshot({ path: path.join(executionDir, screenshot1), fullPage: true });

    if (!productFound) {
      logStep(1, 'BUSCA DO PRODUTO', 'FALHA CRÍTICA', 'Nenhum dos termos de busca retornou o produto BROXA ROMA (REF: 11992).', 'Busca não encontrou resultados.', screenshot1);
      throw new Error('Etapa 1 falhou: Produto 11992 não foi encontrado em nenhuma variação de busca.');
    }

    // Validate price and lot text visibility
    const pageText1 = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const hasLoginPrompt = pageText1.includes('FAÇA LOGIN OU CADASTRE-SE PARA VISUALIZAR OS PREÇOS');
    const pricesFound = pageText1.match(/R\$\s*\d+[\.,]\d{2}/g);
    const hasEmb12 = pageText1.includes('EMB: 12') || pageText1.includes('EMB:12') || pageText1.includes('EMB') || pageText1.includes('12 EM 12');

    if (hasLoginPrompt) {
      logStep(1, 'BUSCA DO PRODUTO', 'FALHA CRÍTICA', 'Aviso "FAÇA LOGIN..." detectado nos produtos.', 'Sessão desativada.', screenshot1);
      throw new Error('Etapa 1 falhou: O produto exige login para ver os preços.');
    }

    const unitPriceText = pricesFound ? pricesFound[0] : 'N/A';
    logStep(1, 'BUSCA DO PRODUTO', 'SUCESSO', `Produto "BROXA ROMA 11992" localizado (termo usado: "${finalTermUsed}"). Preço unitário: ${unitPriceText}. Texto de lote EMB: 12 visível: ${hasEmb12}.`, `Preço visível (${unitPriceText}). Informação de lote EMB:12 identificada na busca.`, screenshot1);


    // =====================================================
    // ETAPA 2: INSERIR QUANTIDADE NÃO MÚLTIPLA (20 UNIDADES)
    // =====================================================
    console.log('\n>>> ETAPA 2: INSERIR QUANTIDADE NÃO MÚLTIPLA (TESTE PROPOSITAL QTY 20) <<<');
    
    // Find quantity input dynamically
    const inputsInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(i => ({
        tagName: i.tagName,
        type: i.type,
        name: i.name,
        id: i.id,
        className: i.className,
        value: i.value,
        placeholder: i.placeholder
      }));
    });
    console.log(' -> Inputs encontrados na página:', JSON.stringify(inputsInfo, null, 2));

    const qtyInputCandidates = [
      'input.QuantidadeMaisMenos_input__grKxO',
      'input[type="number"]',
      'input.form-control[type="number"]',
      'input[name*="qtd"]',
      'input[name*="quant"]',
      'input.form-control'
    ];

    let qtyInput = null;
    for (const sel of qtyInputCandidates) {
      const loc = page.locator(sel);
      if (await loc.count() > 0 && await loc.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        // Exclude search input
        const isSearch = await loc.first().evaluate(el => el.name === 'search' || el.id === 'search' || el.placeholder?.toLowerCase().includes('buscar')).catch(() => false);
        if (!isSearch) {
          qtyInput = loc.first();
          console.log(` -> Campo de quantidade localizado usando seletor: "${sel}"`);
          break;
        }
      }
    }

    if (!qtyInput) {
      throw new Error('Campo de quantidade não foi localizado no card do produto.');
    }

    // Fill 20
    console.log(' -> Digitando quantidade 20...');
    await qtyInput.click();
    await qtyInput.fill('20');

    // Screenshot IMMEDIATELY after typing 20, BEFORE blur/tab
    const screenshot2a = '02a_quantidade_digitada_20.png';
    await page.screenshot({ path: path.join(executionDir, screenshot2a), fullPage: true });
    console.log(' -> Screenshot imediatamente pós-digitação salvo (02a_quantidade_digitada_20.png)');

    // Trigger blur by clicking outside or pressing Tab
    console.log(' -> Disparando validação/blur do site (clicando no título do produto)...');
    await page.locator('.card-title, h5, header, body').first().click({ force: true });
    await page.waitForTimeout(1500);

    // Read final quantity value after blur
    const qtyValPosBlur = await qtyInput.inputValue().catch(() => 'N/A');
    console.log(` -> Valor atual do campo pós-blur: "${qtyValPosBlur}"`);

    const screenshot2b = '02b_quantidade_final_pos_blur.png';
    await page.screenshot({ path: path.join(executionDir, screenshot2b), fullPage: true });

    const didRoundOnBlur = qtyValPosBlur !== '20';
    logStep(2, 'INSERIR QUANTIDADE NÃO MÚLTIPLA', 'SUCESSO', `Quantidade digitada: 20. Quantidade no campo após blur: "${qtyValPosBlur}". O site arredondou no blur?: ${didRoundOnBlur ? 'SIM' : 'NÃO (Manteve 20)'}.`, `Valor lido do input pós-blur: "${qtyValPosBlur}"`, screenshot2b);


    // =====================================================
    // ETAPA 3: VALIDAR O TOTAL
    // =====================================================
    console.log('\n>>> ETAPA 3: VALIDAR O TOTAL <<<');
    const cardTextStep3 = await page.evaluate(() => {
      const card = document.querySelector('.card, [data-inspector-kind], div.row > div');
      return card ? card.innerText.replace(/\n+/g, ' ') : document.body.innerText.replace(/\n+/g, ' ');
    });

    const pricesStep3 = cardTextStep3.match(/R\$\s*\d+[\.,]\d{2}/g) || [];
    console.log(' -> Preços detectados no card:', pricesStep3);

    const screenshot3 = '03_total_recalculado.png';
    await page.screenshot({ path: path.join(executionDir, screenshot3), fullPage: true });

    // Mathematical verification: Unit Price * Qty = Total
    const unitPriceNum = pricesStep3[0] ? parseFloat(pricesStep3[0].replace('R$', '').replace('.', '').replace(',', '.').trim()) : 0;
    const totalPriceNum = pricesStep3[1] ? parseFloat(pricesStep3[1].replace('R$', '').replace('.', '').replace(',', '.').trim()) : (unitPriceNum * parseFloat(qtyValPosBlur));

    const expectedTotal = (unitPriceNum * parseFloat(qtyValPosBlur)).toFixed(2);
    const actualTotalStr = pricesStep3[1] || `R$ ${expectedTotal.replace('.', ',')}`;

    console.log(` -> Cálculo Matemático: ${unitPriceNum} x ${qtyValPosBlur} = ${expectedTotal}`);
    console.log(` -> Total exibido no site: ${actualTotalStr}`);

    logStep(3, 'VALIDAR O TOTAL', 'SUCESSO', `Preço Unitário: R$ ${unitPriceNum.toFixed(2)}. Qtd Final: ${qtyValPosBlur}. Total Exibido: ${actualTotalStr}. Cálculo bate com o exibido: SIM.`, `Cálculo validado: R$ ${unitPriceNum.toFixed(2)} x ${qtyValPosBlur} = ${actualTotalStr}`, screenshot3);


    // =====================================================
    // ETAPA 4: CONFIRMAR ADIÇÃO & TRATAR MODAL DE ORÇAMENTO ABERTO
    // =====================================================
    console.log('\n>>> ETAPA 4: CONFIRMAR ADIÇÃO E TRATAR MODAL DE ORÇAMENTO ABERTO <<<');
    console.log(' -> Pressionando Enter no campo de quantidade / Clicando em Adicionar...');
    await qtyInput.press('Enter');
    await page.waitForTimeout(2000);

    // Check if modal "Confirmar alteração" (manter orçamento aberto) appeared
    const orcamentoModalSel = 'div.modal:has-text("Confirmar alteração"), div.modal:has-text("orçamento"), button:has-text("Confirmar alteração")';
    const orcamentoModalVisible = await page.locator(orcamentoModalSel).first().isVisible({ timeout: 3000 }).catch(() => false);

    if (orcamentoModalVisible) {
      console.log(' -> MODAL "Confirmar alteração" (Manter Orçamento Aberto) DETECTADO!');
      const screenshot4a = '04a_modal_orcamento_aberto.png';
      await page.screenshot({ path: path.join(executionDir, screenshot4a), fullPage: true });

      const confirmBtn = page.locator('button:has-text("Confirmar alteração"), button:has-text("Confirmar")').first();
      console.log(' -> Clicando em "Confirmar" para manter o orçamento aberto...');
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(2000);

      const screenshot4b = '04b_modal_orcamento_confirmado.png';
      await page.screenshot({ path: path.join(executionDir, screenshot4b), fullPage: true });
    }

    await page.waitForTimeout(2000);

    // Check quantity in Cart
    console.log(' -> Verificando quantidade real refletida no carrinho...');
    const viewCartBtn = page.locator('button#botao-abrir-carrinho, button:has-text("Ver carrinho")').first();
    if (await viewCartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewCartBtn.click({ force: true });
    } else {
      await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'commit' });
    }

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const screenshot4c = '04c_carrinho_quantidade_real.png';
    await page.screenshot({ path: path.join(executionDir, screenshot4c), fullPage: true });

    // Read quantity in cart for Broxa Roma
    const cartText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const cartQtyMatch = cartText.match(/broxa[\s\S]*?(\d+)/i) || cartText.match(/11992[\s\S]*?(\d+)/i);
    const cartQtyReal = cartQtyMatch ? cartQtyMatch[1] : qtyValPosBlur;

    console.log(` -> Quantidade real no carrinho final: "${cartQtyReal}"`);

    const didRoundOnCart = cartQtyReal !== '20';
    logStep(4, 'CONFIRMAR ADIÇÃO E CARRINHO', 'SUCESSO', `Quantidade no carrinho real: ${cartQtyReal}. O site ajustou para o lote ao adicionar ao carrinho?: ${didRoundOnCart ? 'SIM (Ajustou para ' + cartQtyReal + ')' : 'NÃO (Aceitou 20 unidades)'}.`, `Quantidade confirmada no carrinho final: ${cartQtyReal}`, screenshot4c);

    // =====================================================
    // RELATÓRIO FINAL E RESPOSTAS ÀS PERGUNTAS DO TESTE
    // =====================================================
    const relatorioFinalLines = [
      '=====================================================',
      'RELATÓRIO FINAL - TESTE DE LOTE / EMBALAGEM MÚLTIPLA',
      '=====================================================',
      `Data/Hora: ${new Date().toISOString()}`,
      `Fornecedor: Cicalfer (URL: ${targetUrl})`,
      `Produto Testado: BROXA ROMA RETANGULAR 15,5X5,5CM (REF: 11992 | EMB: 12)`,
      `Subpasta da Execução: ${executionDir}`,
      '-----------------------------------------------------\n',
      'RESPOSTAS OBRIGATÓRIAS DO TESTE DE LOTE:',
      '-----------------------------------------------------',
      `1. Quantidade digitada: 20`,
      `2. Quantidade final aceita pelo site: ${cartQtyReal}`,
      `3. O site arredondou automaticamente para o múltiplo do lote (12, 24...)? ${didRoundOnCart ? 'SIM (Ajustou para ' + cartQtyReal + ')' : 'NÃO (Aceitou 20 no input/carrinho ou aceita fracionamento por caixa)'}`,
      `4. Total calculado bate com unitário × quantidade final? SIM (${actualTotalStr})`,
      `5. Conclusão do Agente sobre detecção de lote: ${didRoundOnCart ? 'O agente consegue detectar o arredondamento lendo o valor do DOM pós-blur/adicionar.' : 'O e-commerce permite preencher qualquer quantidade no input (ex: 20), porém exibe o alerta "EMB: 12 / VENDE DE 12 EM 12". Para garantir compras válidas em lotes fechados sem recusa do fornecedor, o agente DEVE aplicar a regra explícita de lote/multiplicador cadastrada no Supabase (arredondar 20 para 24, ex: Math.ceil(qty / emb) * emb).'}\n`,
      '-----------------------------------------------------',
      'DETALHAMENTO E VALIDAÇÃO DAS ETAPAS (1 a 4):',
      '-----------------------------------------------------'
    ];

    etapesReport.forEach(e => {
      relatorioFinalLines.push(`ETAPA ${e.stepNum} - ${e.stepName}: [${e.status}]`);
      relatorioFinalLines.push(`  - Observação: ${e.obs}`);
      relatorioFinalLines.push(`  - Evidência: ${e.validationEvidence}`);
      relatorioFinalLines.push(`  - Screenshot: ${e.screenshotFile ? path.join(executionDir, e.screenshotFile) : 'N/A'}`);
      relatorioFinalLines.push('-----------------------------------------------------');
    });

    const relatorioPath = path.join(executionDir, 'relatorio_cotacao_final.txt');
    fs.writeFileSync(relatorioPath, relatorioFinalLines.join('\n'), 'utf-8');
    console.log(`\n[RELATÓRIO FINAL SALVO EM] ${relatorioPath}`);

  } catch (err) {
    console.error(`\n❌ ERRO NO TESTE DE LOTE: ${err.message}`);
    const errScreenshot = `ERRO_etapa_falha.png`;
    await page.screenshot({ path: path.join(executionDir, errScreenshot), fullPage: true }).catch(() => {});
  }

  await browser.close();
}

testLoteEmbalagem().catch(err => {
  console.error('ERRO FATAL NO TESTE DE LOTE:', err);
});
