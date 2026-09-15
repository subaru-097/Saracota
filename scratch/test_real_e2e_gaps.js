const http = require('http');
const path = require('path');
const fs = require('fs');

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

async function runE2EGapValidation() {
  console.log('================================================================');
  console.log('🧪 E2E REPRODUÇÃO EMPÍRICA DOS GAPS (CONSTRUJÁ + CICALFER)');
  console.log('================================================================\n');

  const fornConstruja = { id: 'a1684c4d-d896-4ba9-a591-cda455c5ffe2', nome: 'Construjá' };
  const fornCicalfer = { id: '33e03495-100d-45a3-9e34-899de56b0ab1', nome: 'Cicalfer' };

  // ----------------------------------------------------------------
  // TESTE 1: GAP 1 — FECHAMENTO DO MODAL MATA A SESSÃO VIA action: 'close'
  // ----------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('🔥 TESTE COMPROVATÓRIO — GAP 1: Fechamento do modal (action: close)');
  console.log('----------------------------------------------------------------');

  const { BrowserbaseService } = require('../lib/services/automacao/browserbaseService');
  const { db } = require('../lib/db/client');

  const cotacaoIdGap1 = `cot-real-gap1-${Date.now()}`;
  console.log(`[PASSO 1.1] Criando sessão real no Browserbase para ${fornConstruja.nome}...`);

  const sessaoConstruja = await BrowserbaseService.criarEMontarSessaoRemota({
    fornecedorId: fornConstruja.id,
    fornecedorUrl: 'https://www.construja.com.br/produtos',
    itens: [{ texto: 'Disjuntor Bipolar 20A', quantidade: 2 }]
  });

  console.log('✅ Sessão Remota Construjá Criada:');
  console.log('   - Session ID:', sessaoConstruja.sessionId);
  console.log('   - Live View URL:', sessaoConstruja.liveViewUrl);

  // Salvar no BD/Cache para simular fluxo completo da cotação
  await db.cotacoes.salvarBrowserbaseSessionId(cotacaoIdGap1, fornConstruja.id, sessaoConstruja.sessionId);

  console.log(`\n[PASSO 1.2] Verificando consulta da sessão antes de fechar o modal...`);
  const resBeforeClose = await postJson('http://localhost:3000/api/browserbase/session', {
    cotacaoId: cotacaoIdGap1,
    fornecedorId: fornConstruja.id
  });
  console.log('📥 RESPOSTA ANTES DO CLOSE (Status ' + resBeforeClose.status + '):', JSON.stringify(resBeforeClose.data, null, 2));

  console.log(`\n[PASSO 1.3] Disparando action: 'close' (simulando clique em "Fechar Janela" no modal)...`);
  const closePayload = { action: 'close', sessionId: sessaoConstruja.sessionId };
  console.log('👉 REQUEST Payload (POST /api/browserbase/session):', JSON.stringify(closePayload, null, 2));

  const resCloseAction = await postJson('http://localhost:3000/api/browserbase/session', {
    action: 'close',
    sessionId: sessaoConstruja.sessionId
  });
  console.log('📥 RESPOSTA DO CLOSE ACTION (Status ' + resCloseAction.status + '):', JSON.stringify(resCloseAction.data, null, 2));

  console.log(`\n[PASSO 1.4] Tentando consultar novamente a sessão (${sessaoConstruja.sessionId}) após o fechar...`);
  const resAfterClose = await postJson('http://localhost:3000/api/browserbase/session', {
    action: 'refresh',
    sessionId: sessaoConstruja.sessionId
  });
  console.log('📥 RESPOSTA APÓS CLOSE (Status ' + resAfterClose.status + '):', JSON.stringify(resAfterClose.data, null, 2));


  // ----------------------------------------------------------------
  // TESTE 2: GAP 2 — REUSO GENÉRICO DE SESSÃO RUNNING ENTRE FORNECEDORES
  // ----------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('🔥 TESTE COMPROVATÓRIO — GAP 2: Reuso genérico (runningList[0])');
  console.log('----------------------------------------------------------------');

  console.log('[PASSO 2.1] Abrindo 1ª sessão remota para Construjá (mantendo RUNNING)...');
  const sessaoConstruja2 = await BrowserbaseService.criarEMontarSessaoRemota({
    fornecedorId: fornConstruja.id,
    fornecedorUrl: 'https://www.construja.com.br/produtos',
    itens: [{ texto: 'Cabo Flexível 2,5mm', quantidade: 1 }]
  });
  console.log('✅ Sessão Construjá 2 Criada. Session ID:', sessaoConstruja2.sessionId);

  console.log('\n[PASSO 2.2] Sem fechar Construjá, abrindo sessão para Cicalfer...');
  const sessaoCicalfer = await BrowserbaseService.criarEMontarSessaoRemota({
    fornecedorId: fornCicalfer.id,
    fornecedorUrl: 'https://cicalfer.com.br/',
    itens: [{ texto: 'Tubo PVC 100mm', quantidade: 3 }]
  });
  console.log('✅ Sessão Cicalfer Criada. Session ID:', sessaoCicalfer.sessionId);

  console.log('\n📊 COMPARATIVO EMPÍRICO DE SESSION IDs:');
  console.log('   - Construja SessionId:', sessaoConstruja2.sessionId);
  console.log('   - Cicalfer SessionId :', sessaoCicalfer.sessionId);
  console.log('   - Reutilizou a mesma sessão (Hijacking)?:', sessaoConstruja2.sessionId === sessaoCicalfer.sessionId ? 'SIM (MESMO SESSION_ID DETECTADO)' : 'NÃO (Nova sessão gerada)');


  // ----------------------------------------------------------------
  // TESTE 3 & 4: FRONTEND CACHE & UI TABS
  // ----------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('🔥 TESTE COMPROVATÓRIO — GAP 3 & GAP 4: Cache & UI');
  console.log('----------------------------------------------------------------');

  console.log('Inspeção do handler de fechar em CotacoesView.tsx:');
  const cotacoesCode = fs.readFileSync(path.join(__dirname, '../components/features/CotacoesView.tsx'), 'utf-8');
  const matchCacheDelete = cotacoesCode.includes('delete updated[browserbaseFornId]');
  console.log('   - O código executa `delete updated[browserbaseFornId]` ao fechar o modal?:', matchCacheDelete ? 'SIM (Deleta cache do fornecedor ao fechar)' : 'NÃO');

  console.log('\nInspeção do modal em BrowserbaseLiveViewModal.tsx:');
  const modalCode = fs.readFileSync(path.join(__dirname, '../components/features/BrowserbaseLiveViewModal.tsx'), 'utf-8');
  const matchTabs = modalCode.includes('fornecedorTab') || modalCode.includes('selectedSupplier');
  console.log('   - O modal possui suporte a abas de múltiplos fornecedores?:', matchTabs ? 'SIM' : 'NÃO (Apenas aceita um fornecedor por vez via prop fornecedorNome)');

  console.log('\n================================================================');
  console.log('🏁 FIM DA EXECUÇÃO EMPÍRICA');
  console.log('================================================================');
}

runE2EGapValidation().catch(console.error);
