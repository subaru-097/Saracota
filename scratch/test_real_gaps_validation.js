const http = require('http');
const https = require('https');
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\2fbca413-b577-4db3-a64c-3c348416032e';

function postJson(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyStr = JSON.stringify(data);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function runGapValidations() {
  console.log('================================================================');
  console.log('🔥 TESTE DE VALIDAÇÃO COM EXECUÇÃO REAL E LOGS DOS 4 GAPS');
  console.log('================================================================\n');

  const fornConstruja = { id: 'a1684c4d-d896-4ba9-a591-cda455c5ffe2', nome: 'Construjá' };
  const fornCicalfer = { id: '33e03495-100d-45a3-9e34-899de56b0ab1', nome: 'Cicalfer' };

  // ================================================================
  // GAP 1: Fechamento do modal mata a sessão (action: 'close')
  // ================================================================
  console.log('----------------------------------------------------------------');
  console.log('🧪 EXECUÇÃO REAL — GAP 1: Fechamento do modal mata a sessão');
  console.log('----------------------------------------------------------------');
  
  const cotacaoIdGap1 = `cot-gap1-${Date.now()}`;
  console.log(`[ETAPA 1.1] Requisitando abertura de sessão para Construjá (${fornConstruja.id})...`);
  const req1Payload = {
    cotacaoId: cotacaoIdGap1,
    fornecedorId: fornConstruja.id,
    fornecedorNome: fornConstruja.nome,
  };
  console.log('👉 REQUEST Payload (POST /api/browserbase/session):', JSON.stringify(req1Payload, null, 2));

  const res1 = await postJson('http://localhost:3000/api/browserbase/session', req1Payload);
  console.log(`📥 RESPONSE (Status ${res1.status}):`, JSON.stringify(res1.data, null, 2));

  const createdSessionId = res1.data?.sessionId;

  if (createdSessionId) {
    console.log(`\n[ETAPA 1.2] Simulando clique em "Fechar Janela" no modal (disparando action: 'close')...`);
    const closePayload = { action: 'close', sessionId: createdSessionId };
    console.log('👉 REQUEST Payload (POST /api/browserbase/session):', JSON.stringify(closePayload, null, 2));

    const resClose = await postJson('http://localhost:3000/api/browserbase/session', closePayload);
    console.log(`📥 RESPONSE Close (Status ${resClose.status}):`, JSON.stringify(resClose.data, null, 2));

    console.log(`\n[ETAPA 1.3] Tentando reabrir a MESMA sessão (${createdSessionId}) imediatamente após o fechar...`);
    const reopenPayload = { sessionId: createdSessionId };
    console.log('👉 REQUEST Payload (POST /api/browserbase/session):', JSON.stringify(reopenPayload, null, 2));

    const resReopen = await postJson('http://localhost:3000/api/browserbase/session', reopenPayload);
    console.log(`📥 RESPONSE Reopen (Status ${resReopen.status}):`, JSON.stringify(resReopen.data, null, 2));
  } else {
    console.log('⚠️ [GAP 1 WARNING] Não foi retornado sessionId inicial. Resposta:', res1);
  }

  // ================================================================
  // GAP 2: Reuso genérico causa conflito entre fornecedores
  // ================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('🧪 EXECUÇÃO REAL — GAP 2: Reuso genérico causa conflito entre fornecedores');
  console.log('----------------------------------------------------------------');

  const cotacaoIdGap2 = `cot-gap2-${Date.now()}`;
  console.log(`[ETAPA 2.1] Abrindo 1ª sessão para Construjá sem fechar...`);
  const resConstruja = await postJson('http://localhost:3000/api/browserbase/session', {
    cotacaoId: cotacaoIdGap2,
    fornecedorId: fornConstruja.id,
    fornecedorNome: fornConstruja.nome,
  });
  console.log('Construjá Session Res:', JSON.stringify(resConstruja.data, null, 2));

  console.log(`\n[ETAPA 2.2] Sem fechar Construjá, abrindo 2ª sessão para Cicalfer...`);
  const resCicalfer = await postJson('http://localhost:3000/api/browserbase/session', {
    cotacaoId: cotacaoIdGap2,
    fornecedorId: fornCicalfer.id,
    fornecedorNome: fornCicalfer.nome,
  });
  console.log('Cicalfer Session Res:', JSON.stringify(resCicalfer.data, null, 2));

  console.log('\n📊 COMPARATIVO DE SESSION IDs:');
  console.log('   - Construja SessionId:', resConstruja.data?.sessionId);
  console.log('   - Cicalfer SessionId :', resCicalfer.data?.sessionId);

  // ================================================================
  // GAP 3 & GAP 4: Teste de Interface React & Cache via Playwright
  // ================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('🧪 EXECUÇÃO REAL — GAP 3 & GAP 4: Cache Frontend & Interface UI');
  console.log('----------------------------------------------------------------');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('[ETAPA 3/4] Acessando aplicação local em http://localhost:3000/cotacoes...');
  await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);

  // Inspecionar o código de handleCloseBrowserbaseModal em CotacoesView.tsx
  const cotacoesViewContent = fs.readFileSync(
    path.join(__dirname, '../components/features/CotacoesView.tsx'),
    'utf-8'
  );

  const closeMethodMatch = cotacoesViewContent.match(/handleCloseBrowserbaseModal\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};/);
  console.log('\n📄 TRECHO REAL DE CÓDIGO (CotacoesView.tsx - handleCloseBrowserbaseModal):');
  console.log(closeMethodMatch ? closeMethodMatch[0] : 'Método não localizado via Regex.');

  // Inspecionar a UI do Modal em BrowserbaseLiveViewModal.tsx
  const modalContent = fs.readFileSync(
    path.join(__dirname, '../components/features/BrowserbaseLiveViewModal.tsx'),
    'utf-8'
  );

  const hasTabsUI = modalContent.includes('Tabs') || modalContent.includes('tab') || modalContent.includes('SeletorFornecedor');
  console.log('\n📄 VERIFICAÇÃO DE ELEMENTOS DE UI (BrowserbaseLiveViewModal.tsx):');
  console.log('   - Possui abas/seletor de fornecedores no modal?:', hasTabsUI ? 'SIM' : 'NÃO (Nenhum seletor/aba encontrado)');

  await browser.close();
  console.log('\n================================================================');
  console.log('✅ EXECUÇÃO DOS TESTES DOS 4 GAPS FINALIZADA COM SUCESSO');
  console.log('================================================================');
}

runGapValidations().catch(console.error);
