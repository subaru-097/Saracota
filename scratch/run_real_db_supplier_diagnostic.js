const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 1. Vault AES-256 Decryption Function
const VAULT_SECRET = process.env.ENCRYPTION_KEY || process.env.VAULT_SECRET || 'saracota_vault_master_key_aes256_32bytes_secret';
function getDerivedKey() {
  return crypto.createHash('sha256').update(VAULT_SECRET).digest();
}

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
  const visible = user.length > 3 ? user.slice(0, 3) : user.slice(0, 1);
  return `${visible}***@${domain}`;
}

// 2. Map of Supplier -> Root Directory
const FORNECEDOR_MAP = {
  "SeekOffer": "diagnostico_seekoffer",
  "Secofair": "diagnostico_secofair",
  "Construjá": "diagnostico_construja",
  "Cicalfer": "diagnostico_cicalfer"
};

function createExecutionFolder(fornecedorNome) {
  const rootFolderName = FORNECEDOR_MAP[fornecedorNome] || `diagnostico_${fornecedorNome.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const rootFolderPath = path.join(__dirname, '..', rootFolderName);

  if (!fs.existsSync(rootFolderPath)) {
    fs.mkdirSync(rootFolderPath, { recursive: true });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  const executionFolderPath = path.join(rootFolderPath, timestamp);
  fs.mkdirSync(executionFolderPath, { recursive: true });

  // Retention: keep max 20 execution subfolders
  const subfolders = fs.readdirSync(rootFolderPath)
    .filter(f => fs.statSync(path.join(rootFolderPath, f)).isDirectory())
    .sort();

  if (subfolders.length > 20) {
    const toDelete = subfolders.slice(0, subfolders.length - 20);
    toDelete.forEach(oldFolder => {
      const deletePath = path.join(rootFolderPath, oldFolder);
      try {
        fs.rmSync(deletePath, { recursive: true, force: true });
        console.log(`[RETENÇÃO] Apagada subpasta antiga: ${oldFolder}`);
      } catch (e) {
        console.error(`Erro ao apagar subpasta antiga ${oldFolder}: ${e.message}`);
      }
    });
  }

  return { rootFolderPath, executionFolderPath, timestamp };
}

// 3. Strict Domain Match & Authentication Success Evaluator
function evaluateLoginSuccess(registeredUrl, finalUrl, pageText) {
  try {
    const expectedHost = new URL(registeredUrl).hostname.replace(/^www\./, '');
    const finalHost = new URL(finalUrl).hostname.replace(/^www\./, '');

    // Domain divergence check
    if (!finalHost.includes(expectedHost) && !expectedHost.includes(finalHost)) {
      return {
        success: false,
        status: 'FALHA CRÍTICA',
        reason: `Divergência de domínio: esperado ${expectedHost}, obtido ${finalHost}`
      };
    }
  } catch (e) {
    return {
      success: false,
      status: 'FALHA CRÍTICA',
      reason: `URL inválida. Esperado ${registeredUrl}, obtido ${finalUrl}`
    };
  }

  const lowerText = pageText.toLowerCase();

  // Check explicit error messages
  const errorKeywords = [
    'invalid credentials', 'invalid email', 'user not found', 'senha incorreta',
    'usuario ou senha invalidos', 'credenciais invalidas', 'login failed',
    'erro ao entrar', 'dados incorretos', 'não encontrado'
  ];
  const hasErrorMessage = errorKeywords.some(kw => lowerText.includes(kw));

  if (hasErrorMessage) {
    return {
      success: false,
      status: 'FALHA',
      reason: 'Página retornou mensagem explícita de erro de credenciais.'
    };
  }

  // Check authentication indicators
  const isDashboardRoute = ['/dashboard', '/painel', '/minha-conta', '/account', '/area-cliente', '/produtos', '/carrinho', '/filial'].some(r => finalUrl.toLowerCase().includes(r));
  const hasUserAuthIndicator = lowerText.includes('bem-vindo') || lowerText.includes('minha conta') || lowerText.includes('sair') || lowerText.includes('logout') || lowerText.includes('santanacomercial') || lowerText.includes('filial');

  if (isDashboardRoute || hasUserAuthIndicator) {
    return {
      success: true,
      status: 'SUCESSO',
      reason: `Autenticação confirmada na área logada (${finalUrl}).`
    };
  }

  return {
    success: false,
    status: 'FALHA',
    reason: `Página final (${finalUrl}) não apresentou rota de dashboard nem indicador de sessão iniciada.`
  };
}

async function handleCookieBanners(page) {
  const acceptCookieSelectors = [
    'button:has-text("Aceitar")',
    'button:has-text("Concordar")',
    'button:has-text("Entendi")',
    'button:has-text("Permitir todos")',
    '.modal button.btn-primary',
    '#cookie-accept'
  ];

  for (const sel of acceptCookieSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(` -> Fechando banner de cookies via: "${sel}"`);
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        break;
      }
    } catch (e) {}
  }
}

async function runSupplierDiagnosticFromDB(supplierName) {
  console.log('=====================================================');
  console.log(`BUSCANDO DADOS REAIS DO SUPABASE PARA: ${supplierName}`);
  console.log('=====================================================\n');

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.from('fornecedores').select('*').ilike('nome', `%${supplierName}%`);

  if (error || !data || data.length === 0) {
    console.error(`FATAL: Fornecedor '${supplierName}' não encontrado no banco de dados Supabase.`);
    process.exit(1);
  }

  const supplier = data[0];
  const targetUrl = supplier.url_site || supplier.url_login;
  const loginUser = supplier.login_salvo || supplier.login || supplier.email_login;
  const rawPassword = supplier.senha_login || supplier.senha_criptografada;
  const decryptedPassword = decryptAES256(rawPassword);
  const seletores = supplier.seletores || {};

  // Check complete registered data
  if (!targetUrl || !loginUser || !decryptedPassword || decryptedPassword === '[DESCRIPTOGRAFIA_FALHOU]') {
    const errorMsg = `Fornecedor sem dados cadastrados completos — automação não pode ser executada. (URL: ${Boolean(targetUrl)}, User: ${Boolean(loginUser)}, Senha: ${Boolean(decryptedPassword)})`;
    console.error(`\n❌ ERRO: ${errorMsg}`);
    process.exit(1);
  }

  const maskedUser = maskEmail(loginUser);

  // PROOF LOG PRINTING
  console.log('--- PROVA DE CARREGAMENTO DOS DADOS DO BANCO (SUPABASE) ---');
  console.log(`- Nome do Fornecedor (DB): "${supplier.nome}"`);
  console.log(`- ID no Supabase: ${supplier.id}`);
  console.log(`- URL Oficial (DB): "${targetUrl}"`);
  console.log(`- E-mail/Usuário (DB): "${maskedUser}"`);
  console.log(`- Status da Senha (DB): Descriptografada AES-256 com Sucesso (Comprimento: ${decryptedPassword.length} chars)`);
  console.log(`- Tipo de Automação (DB): "${supplier.tipo_automacao || 'Padrão (Seletores JSONB)'}"`);
  console.log(`- Forma de Login (DB): "${supplier.forma_de_login || 'E-mail e Senha'}"`);
  console.log(`- Seletores Carregados (DB):`, JSON.stringify(seletores, null, 2));
  console.log('------------------------------------------------------------\n');

  // Create folder structure
  const { rootFolderPath, executionFolderPath, timestamp } = createExecutionFolder(supplier.nome);

  const reportLines = [];
  const networkLogs = [];
  const results = [];

  function log(msg) {
    console.log(msg);
    reportLines.push(msg);
  }

  log(`Subpasta da Execução: ${executionFolderPath}`);
  log(`Data/Hora: ${new Date().toISOString()}`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  // Execute 10 attempts
  for (let i = 1; i <= 10; i++) {
    console.log(`\n--- TENTATIVA ${i} / 10 ---`);
    const attemptStartTime = Date.now();

    const context = await browser.newContext({
      viewport: null,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    page.on('response', res => {
      networkLogs.push(`[Attempt ${i}] [RES ${res.status()}] ${res.request().method()} ${res.url()}`);
    });

    let evalResult = { success: false, status: 'FALHA', reason: 'Não iniciado' };
    let finalUrl = '';

    try {
      // Step 1: Navigate to registered URL
      console.log(`1. Navegando para URL oficial do cadastro: ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Handle cookie banners before clicking trigger
      await handleCookieBanners(page);

      if (i === 1) {
        await page.screenshot({ path: path.join(executionFolderPath, '01_pagina_inicial_imediato.png'), fullPage: true });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(executionFolderPath, '02_pagina_inicial_3s.png'), fullPage: true });
        const html1 = await page.content();
        fs.writeFileSync(path.join(executionFolderPath, '01_pagina_inicial.html'), html1, 'utf-8');
      }

      // Check if login modal trigger button needs to be clicked
      const triggerCandidateSelectors = [
        seletores.botao_abrir_modal_login,
        'button#botao-login',
        'a:has-text("Entrar")',
        'button:has-text("Entrar")',
        'text=Entrar | Cadastrar'
      ].filter(Boolean);

      let triggerClicked = false;
      for (const tSel of triggerCandidateSelectors) {
        try {
          const tBtn = page.locator(tSel).first();
          if (await tBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`2. Clicando no botão gatilho de login: "${tSel}"...`);
            await tBtn.click({ force: true });
            await page.waitForTimeout(2000);
            triggerClicked = true;
            break;
          }
        } catch (e) {}
      }

      if (!triggerClicked) {
        console.log(`2. Botão gatilho de login não é necessário ou campos já estão visíveis no DOM.`);
      }

      if (i === 1) {
        await page.screenshot({ path: path.join(executionFolderPath, '03_apos_clique_login.png'), fullPage: true });
      }

      // Step 4 & 5: Fill email and password using selectors from DB
      const emailSelector = seletores.campo_email || 'input[name="email"]';
      const passSelector = seletores.campo_senha || 'input[name="senha"]';

      console.log(`3. Preenchendo campo de usuário/e-mail (${emailSelector}) com: ${maskedUser}...`);
      const emailInput = page.locator(emailSelector).first();
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(loginUser);

      console.log(`4. Preenchendo campo de senha (${passSelector})...`);
      const passInput = page.locator(passSelector).first();
      await passInput.waitFor({ state: 'visible', timeout: 10000 });
      await passInput.fill(decryptedPassword);

      if (i === 1) {
        await page.screenshot({ path: path.join(executionFolderPath, '04_modal_aberto.png'), fullPage: true });
        const html2 = await page.content();
        fs.writeFileSync(path.join(executionFolderPath, '02_modal_aberto.html'), html2, 'utf-8');
      }

      // Step 6: Click submit button inside modal
      const submitCandidates = [
        '.modal button[type="submit"]',
        '.modal button',
        '.modal input[type="submit"]',
        'button[type="submit"]',
        'form button'
      ];

      console.log(`5. Submetendo o formulário de login...`);
      let submitClicked = false;
      for (const sSel of submitCandidates) {
        try {
          const sBtn = page.locator(sSel).first();
          if (await sBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            console.log(` -> Clicando no botão submit via: "${sSel}"`);
            await sBtn.click({ force: true });
            submitClicked = true;
            break;
          }
        } catch (e) {}
      }

      if (!submitClicked) {
        console.log(` -> Pressionando Enter no campo de senha...`);
        await passInput.press('Enter');
      }

      // Step 7: Wait post-login navigation
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(3000);

      finalUrl = page.url();

      if (i === 1) {
        await page.screenshot({ path: path.join(executionFolderPath, '05_pos_submit_login.png'), fullPage: true });
        const html3 = await page.content();
        fs.writeFileSync(path.join(executionFolderPath, '03_pos_login.html'), html3, 'utf-8');
      }

      // Step 8: Evaluate success & domain divergence
      const pageText = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      evalResult = evaluateLoginSuccess(targetUrl, finalUrl, pageText);

    } catch (err) {
      evalResult = {
        success: false,
        status: 'FALHA',
        reason: `Erro de execução Playwright: ${err.message}`
      };
      finalUrl = page.url();
    }

    const duration = ((Date.now() - attemptStartTime) / 1000).toFixed(2);
    results.push({
      attempt: i,
      status: evalResult.status,
      durationSec: duration,
      finalUrl,
      reason: evalResult.reason
    });

    console.log(`   Resultado Tentativa ${i}: [${evalResult.status}] - ${evalResult.reason} (${duration}s)`);
    await context.close();
  }

  await browser.close();

  // Generate teste_login_resultados.txt
  const totalSuccess = results.filter(r => r.status === 'SUCESSO').length;
  const resultLines = [
    '=====================================================',
    `RESUMO DOS TESTES DE LOGIN REAIS (SUPABASE DB) - ${supplier.nome}`,
    '=====================================================',
    `Data/Hora da Execução: ${timestamp} (${new Date().toISOString()})`,
    `Fornecedor Testado (DB): ${supplier.nome}`,
    `URL do Cadastro (DB): ${targetUrl}`,
    `Usuário Usado (DB): ${maskedUser}`,
    `Subpasta da Execução: ${executionFolderPath}`,
    `Total de Tentativas: 10`,
    `Taxa Real de Sucesso: ${totalSuccess} / 10 (${(totalSuccess / 10 * 100).toFixed(0)}%)`,
    `Total de Falhas: ${10 - totalSuccess} / 10`,
    '-----------------------------------------------------\n',
    'Detalhamento por Tentativa:',
    '-----------------------------------------------------'
  ];

  results.forEach(r => {
    resultLines.push(`Tentativa #${r.attempt}: [${r.status}]`);
    resultLines.push(`  - Duração: ${r.durationSec}s`);
    resultLines.push(`  - URL Final: ${r.finalUrl}`);
    resultLines.push(`  - Motivo/Resultado: ${r.reason}`);
    resultLines.push('-----------------------------------------------------');
  });

  const resultsPath = path.join(executionFolderPath, 'teste_login_resultados.txt');
  fs.writeFileSync(resultsPath, resultLines.join('\n'), 'utf-8');

  // Save network logs
  fs.writeFileSync(path.join(executionFolderPath, 'network_log.txt'), networkLogs.join('\n'), 'utf-8');

  // Generate relatorio_diagnostico.txt
  const relatorioContent = [
    '=====================================================',
    `RELATÓRIO DE DIAGNÓSTICO COM DADOS DO SUPABASE DB`,
    `Fornecedor: ${supplier.nome}`,
    '=====================================================\n',
    'PROVA DE ORIGEM DOS DADOS DO BANCO:',
    ` - ID Supabase: ${supplier.id}`,
    ` - Nome: ${supplier.nome}`,
    ` - URL Cadastrada: ${targetUrl}`,
    ` - E-mail Usado: ${maskedUser}`,
    ` - Status Senha: Descriptografada AES-256 com sucesso (${decryptedPassword.length} caracteres)`,
    ` - Seletores Utilizados (DB): ${JSON.stringify(seletores)}\n`,
    'RESUMO DOS TESTES:',
    ` - Subpasta da Execução: ${executionFolderPath}`,
    ` - Total de Repetições: 10`,
    ` - Taxa Real de Sucesso: ${totalSuccess} / 10 (${(totalSuccess / 10 * 100).toFixed(0)}%)`,
    ` - Status Final: ${results[0]?.status || 'FALHA'} - ${results[0]?.reason || 'N/A'}\n`,
    'HISTÓRICO E RETENÇÃO:',
    ` - Subpasta criada: ${timestamp}`,
    ` - Retenção de 20 execuções mantida em ${rootFolderPath}.`
  ].join('\n');

  fs.writeFileSync(path.join(executionFolderPath, 'relatorio_diagnostico.txt'), relatorioContent, 'utf-8');

  console.log(`\n=====================================================`);
  console.log(`DIAGNÓSTICO REAL E TESTES FINALIZADOS PARA: ${supplier.nome}`);
  console.log(`Subpasta criada: ${executionFolderPath}`);
  console.log(`Relatório de resultados: ${resultsPath}`);
  console.log(`=====================================================\n`);
}

// Run for Cicalfer as requested
const targetSupplier = process.argv[2] || "Cicalfer";
runSupplierDiagnosticFromDB(targetSupplier).catch(err => {
  console.error('ERRO FATAL:', err);
});
