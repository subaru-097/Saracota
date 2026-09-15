require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { Browserbase } = require('@browserbasehq/sdk');

async function testarChaveBrowserbase() {
  console.log('================================================================');
  console.log('🔑 PASSO 0: VERIFICAÇÃO DE PRÉ-REQUISITO DA BROWSERBASE_API_KEY');
  console.log('================================================================\n');

  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;

  console.log('📌 Leitura das Variáveis de Ambiente:');
  console.log('   - BROWSERBASE_API_KEY   :', apiKey ? `Presente (${apiKey.substring(0, 8)}... - Tamanho: ${apiKey.length})` : 'AUSENTE / INDEFINIDA');
  console.log('   - BROWSERBASE_PROJECT_ID:', projectId ? `Presente (${projectId})` : 'AUSENTE / INDEFINIDA');

  if (!apiKey || apiKey === 'demo-browserbase-api-key') {
    console.error('\n❌ [PASSO 0 FALHA]: A variável BROWSERBASE_API_KEY está AUSENTE ou configurada com o valor de demonstração "demo-browserbase-api-key".');
    console.error('   Motivo: O ambiente atual não possui credenciais reais da API do Browserbase configuradas no .env / .env.local.');
    process.exit(1);
  }

  console.log('\n📡 Testando autenticação real com a API do Browserbase via SDK (bb.sessions.list)...');

  try {
    const bb = new Browserbase({ apiKey });
    const sessions = await bb.sessions.list();
    console.log('✅ [PASSO 0 SUCESSO]: Autenticação na API do Browserbase bem-sucedida!');
    console.log('   - Total de sessões retornadas:', Array.isArray(sessions) ? sessions.length : JSON.stringify(sessions));
  } catch (err) {
    console.error('\n❌ [PASSO 0 FALHA DE AUTENTICAÇÃO]: Erro ao chamar a API do Browserbase:');
    console.error('   - Mensagem de Erro:', err.message);
    console.error('   - Status / Stack  :', err.status || err.statusCode || err.stack);
    process.exit(1);
  }
}

testarChaveBrowserbase().catch(console.error);
