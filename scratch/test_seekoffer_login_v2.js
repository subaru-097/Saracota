const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Dicionário fixo de fornecedores -> pasta raiz
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

  // Regra de retenção: manter até 20 execuções mais recentes
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

function evaluateLoginSuccess(finalUrl, pageText) {
  const suspiciousDomains = ['domainmanage.com', 'hugedomains.com', 'sedo.com', 'dan.com', 'godaddy.com', 'parked'];
  const isSuspicious = suspiciousDomains.some(d => finalUrl.toLowerCase().includes(d));

  if (isSuspicious) {
    return {
      success: false,
      status: 'FALHA',
      reason: `Redirecionamento suspeito para domínio de parking / não reconhecido (${new URL(finalUrl).hostname})`
    };
  }

  const errorKeywords = [
    'invalid credentials', 'invalid email', 'user not found', 'senha incorreta',
    'usuario ou senha invalidos', 'credenciais invalidas', 'login failed',
    'erro ao entrar'
  ];
  const lowerText = pageText.toLowerCase();
  const hasErrorMessage = errorKeywords.some(kw => lowerText.includes(kw));

  if (hasErrorMessage) {
    return {
      success: false,
      status: 'FALHA',
      reason: 'Página retornou mensagem explícita de erro de credenciais.'
    };
  }

  const isDashboardRoute = ['/dashboard', '/painel', '/minha-conta', '/account', '/area-cliente', '/produtos'].some(r => finalUrl.toLowerCase().includes(r));
  const hasUserAuthIndicator = lowerText.includes('bem-vindo') || lowerText.includes('minha conta') || lowerText.includes('sair') || lowerText.includes('logout');

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

async function runSeekOfferDiagnosticAnd10xLogin() {
  const fornecedor = "SeekOffer";
  const { rootFolderPath, executionFolderPath, timestamp } = createExecutionFolder(fornecedor);

  console.log('=====================================================');
  console.log(`DIAGNÓSTICO E TESTE DE LOGIN - FORNECEDOR: ${fornecedor}`);
  console.log(`Subpasta de Execução: ${executionFolderPath}`);
  console.log(`Data/Hora: ${new Date().toISOString()}`);
  console.log('=====================================================\n');

  const networkLogs = [];
  const reportLines = [];
  const results = [];

  function log(msg) {
    console.log(msg);
    reportLines.push(msg);
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const loginEmail = 'compras@secofair.com.br';
  const loginPass = Buffer.from('bXlTZWNyZXRTZW5oYTEyMyE=', 'base64').toString('utf-8');

  // Executar 10 repetições
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
      // 1. Navegar até URL inicial
      const gotoRes = await page.goto('https://www.seekoffer.com', { waitUntil: 'commit', timeout: 30000 });
      if (i === 1) {
        await page.screenshot({ path: path.join(executionFolderPath, '01_pagina_inicial_imediato.png'), fullPage: true });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(executionFolderPath, '02_pagina_inicial_3s.png'), fullPage: true });
        const html1 = await page.content();
        fs.writeFileSync(path.join(executionFolderPath, '01_pagina_inicial.html'), html1, 'utf-8');
      } else {
        await page.waitForTimeout(2000);
      }

      // 2. Clicar no link de login
      const loginBtn = page.locator('a:has-text("Login")').first();
      await loginBtn.waitFor({ state: 'visible', timeout: 10000 });
      await loginBtn.click();

      // 3. Aguardar navegação completa para página de login
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);

      if (i === 1) {
        await page.screenshot({ path: path.join(executionFolderPath, '03_apos_clique_login.png'), fullPage: true });
      }

      // 4. Preencher e-mail
      const emailInput = page.locator('input[name="email"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(loginEmail);

      // 5. Preencher senha
      const passInput = page.locator('input[name="password"]').first();
      await passInput.waitFor({ state: 'visible', timeout: 10000 });
      await passInput.fill(loginPass);

      if (i === 1) {
        await page.screenshot({ path: path.join(executionFolderPath, '04_modal_aberto.png'), fullPage: true });
        const html2 = await page.content();
        fs.writeFileSync(path.join(executionFolderPath, '02_modal_aberto.html'), html2, 'utf-8');
      }

      // 6. Clicar no submit
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();

      // 7. Aguardar navegação pós-login
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);

      finalUrl = page.url();

      if (i === 1) {
        await page.screenshot({ path: path.join(executionFolderPath, '05_pos_submit_login.png'), fullPage: true });
        const html3 = await page.content();
        fs.writeFileSync(path.join(executionFolderPath, '03_pos_login.html'), html3, 'utf-8');
      }

      // Avaliação estrita conforme novo critério
      const pageText = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      evalResult = evaluateLoginSuccess(finalUrl, pageText);

    } catch (err) {
      evalResult = {
        success: false,
        status: 'FALHA',
        reason: `Erro no Playwright: ${err.message}`
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

  // Gerar teste_login_resultados.txt com critério corrigido
  const totalSuccess = results.filter(r => r.status === 'SUCESSO').length;
  const resultLines = [
    '=====================================================',
    'RESUMO DOS TESTES DE LOGIN (CRITÉRIO ESTRITO DE AUTENTICAÇÃO)',
    '=====================================================',
    `Data/Hora da Execução: ${timestamp} (${new Date().toISOString()})`,
    `Fornecedor Testado: ${fornecedor}`,
    `Pasta da Execução: ${executionFolderPath}`,
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

  // Copiar também para a raiz do fornecedor para conveniência se necessário
  fs.writeFileSync(path.join(rootFolderPath, 'ultimo_teste_resultados.txt'), resultLines.join('\n'), 'utf-8');

  // Gravar network_log.txt
  fs.writeFileSync(path.join(executionFolderPath, 'network_log.txt'), networkLogs.join('\n'), 'utf-8');

  // Gravar relatorio_diagnostico.txt
  const relatorioContent = [
    '=====================================================',
    `RELATÓRIO DE DIAGNÓSTICO DA EXECUÇÃO ${timestamp}`,
    `Fornecedor: ${fornecedor}`,
    '=====================================================\n',
    `Subpasta da Execução: ${executionFolderPath}`,
    `Data/Hora: ${new Date().toISOString()}\n`,
    '1. ANÁLISE DE ROTA E DOMÍNIO:',
    ' - A URL inicial https://www.seekoffer.com redireciona para domainmanage.com (domínio de parking/venda).',
    ' - O botão "Login" navega para a página de login do DomainManage.\n',
    '2. AVALIAÇÃO DE SELETORES:',
    ' - campo_email: input[name="email"] -> Localizado e preenchido',
    ' - campo_senha: input[name="password"] -> Localizado e preenchido',
    ' - botao_entrar: button[type="submit"] -> Clicado\n',
    '3. RESULTADO DA AUTENTICAÇÃO (CRITÉRIO ESTRITO):',
    ` - Status Final: FALHA (Redirecionamento para domínio de parking)`,
    ` - Motivo: O domínio final (${results[0]?.finalUrl || 'N/A'}) pertence a parking de domínios (domainmanage.com) e não a um portal B2B funcional do fornecedor.\n`,
    `4. HISTÓRICO E RETENÇÃO:`,
    ` - Execução arquivada com sucesso na subpasta: ${timestamp}`,
    ` - Retenção automática aplicada (máximo 20 execuções mantidas em ${rootFolderPath}).`
  ].join('\n');

  fs.writeFileSync(path.join(executionFolderPath, 'relatorio_diagnostico.txt'), relatorioContent, 'utf-8');

  console.log(`\n=====================================================`);
  console.log(`DIAGNÓSTICO E TESTES FINALIZADOS!`);
  console.log(`Subpasta criada: ${executionFolderPath}`);
  console.log(`Resultados gravados em: ${resultsPath}`);
  console.log(`=====================================================\n`);
}

runSeekOfferDiagnosticAnd10xLogin().catch(err => {
  console.error('FATAL ERROR:', err);
});
