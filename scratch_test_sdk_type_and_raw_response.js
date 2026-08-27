const { Browserbase } = require('@browserbasehq/sdk');

async function testarRetornoOficialSDK() {
  console.log('\n====================================================');
  console.log('🧪 TESTE DE VALIDAÇÃO DE TIPAGEM E RETORNO REAL DO SDK');
  console.log('====================================================');

  const apiKey = process.env.BROWSERBASE_API_KEY || 'demo-browserbase-api-key';
  const projectId = process.env.BROWSERBASE_PROJECT_ID;

  console.log(`\n📦 Versão do SDK instalada: 2.18.0 (@browserbasehq/sdk)`);
  console.log(`🔑 API Key configurada: ${apiKey.startsWith('demo-') ? 'DEMO / LOCAL' : 'PRODUÇÃO / VERCEL'}`);

  if (apiKey.startsWith('demo-')) {
    console.log('\n💡 [DEMO MODE] Demonstrando estrutura exata da interface SessionLiveURLs (v2.18.0):');
    const mockSessionLiveURLs = {
      debuggerFullscreenUrl: 'https://www.browserbase.com/v1/sessions/bb-sess-demo/debug',
      debuggerUrl: 'wss://connect.browserbase.com/devtools/inspector/page/1',
      wsUrl: 'wss://connect.browserbase.com?sessionId=bb-sess-demo',
      pages: [
        {
          id: 'page-1',
          debuggerFullscreenUrl: 'https://www.browserbase.com/v1/sessions/bb-sess-demo/debug?page=1',
          debuggerUrl: 'wss://connect.browserbase.com/devtools/inspector/page/1',
          faviconUrl: 'https://www.browserbase.com/favicon.ico',
          title: 'Sara Cota Remote Session',
          url: 'https://www.cicalfer.com.br',
        },
      ],
    };
    console.log(JSON.stringify(mockSessionLiveURLs, null, 2));
    return;
  }

  try {
    const bb = new Browserbase({ apiKey });
    console.log('\n📡 1. Criando sessão no Browserbase via SDK...');
    const session = await bb.sessions.create({ projectId });
    console.log(`✅ Sessão criada! ID: ${session.id}`);

    console.log('\n🔍 2. Chamando bb.sessions.debug(session.id)...');
    const debugData = await bb.sessions.debug(session.id);

    console.log('\n====================================================');
    console.log('📄 RESPOSTA REAL COMPLETA DA API BROWSERBASE (RAW JSON):');
    console.log('====================================================');
    console.log(JSON.stringify(debugData, null, 2));

    console.log('\n📌 Validação dos Campos de Interface:');
    console.log('   - debuggerFullscreenUrl:', debugData.debuggerFullscreenUrl);
    console.log('   - debuggerUrl:', debugData.debuggerUrl);
    console.log('   - wsUrl:', debugData.wsUrl);
    console.log('   - pages count:', debugData.pages ? debugData.pages.length : 0);
  } catch (err) {
    console.error('\n❌ Erro ao chamar API oficial do Browserbase:', err.message);
  }
}

testarRetornoOficialSDK();
