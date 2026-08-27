const { BrowserbaseService } = require('./lib/services/automacao/browserbaseService');

async function testarIntegracaoBrowserbase() {
  console.log('====================================================');
  console.log('🧪 TESTE DE VALIDAÇÃO: BROWSERBASE CDP & LIVE VIEW EMBED');
  console.log('====================================================\n');

  console.log('📡 1. Testando criação de sessão remota via BrowserbaseService...');
  const sessaoInfo = await BrowserbaseService.criarSessaoRemota();

  console.log('✅ Sessão obtida:');
  console.log('   - Session ID:', sessaoInfo.sessionId);
  console.log('   - Connect URL (CDP WebSocket):', sessaoInfo.connectUrl);
  console.log('   - Live View URL (Iframe Debug):', sessaoInfo.liveViewUrl);

  if (!sessaoInfo.sessionId || !sessaoInfo.connectUrl || !sessaoInfo.liveViewUrl) {
    console.error('❌ Falha: Dados de sessão Browserbase incompletos.');
    process.exit(1);
  }

  console.log('\n🤖 2. Testando execução remota simulada de automação de carrinho...');
  const resultado = await BrowserbaseService.executarMontagemCarrinhoRemoto({
    fornecedorId: 'forn-cicalfer',
    itens: [
      { texto: 'Cabo flexível sil 2,5mm', quantidade: 2 },
      { texto: 'Disjuntor bipolar 20A', quantidade: 4 },
    ],
  });

  console.log('\n📊 Resultado da Execução Remota:');
  console.log('   - Sucesso:', resultado.sucesso);
  console.log('   - Status:', resultado.status);
  console.log('   - Session ID:', resultado.sessionId);
  console.log('   - Live View URL:', resultado.liveViewUrl);

  if (resultado.sucesso && resultado.liveViewUrl) {
    console.log('\n====================================================');
    console.log('🏆 INTEGRAÇÃO BROWSERBASE + EMBED IFRAME 100% OPERACIONAL!');
    console.log('====================================================');
  } else {
    console.error('❌ Falha na execução remota.');
    process.exit(1);
  }
}

testarIntegracaoBrowserbase();
