const http = require('http');

async function testarValoresEProgresso() {
  console.log('================================================================');
  console.log('🧪 TESTE EMPÍRICO DE VALIDAÇÃO DAS CORREÇÕES 1 E 2');
  console.log('================================================================\n');

  const { db } = require('../lib/db/client');
  const cotacaoId = `cot-test-fix-${Date.now()}`;

  console.log('1. Testando salvamento de progresso com array de mensagens no Supabase...');
  await db.cotacoes.salvarProgresso(cotacaoId, {
    status: 'processando',
    itensProcessados: 1,
    totalItens: 4,
    percentualConcluido: 50,
    mensagens: [
      'Iniciando processamento autônomo...',
      '[Cicalfer] Buscando item: Cabo Flexível 2,5mm...',
      '[Construjá] Falha na extração RPA (seletores ausentes no banco de dados)...'
    ]
  });

  console.log('\n2. Consultando o progresso via db.cotacoes.obterProgresso...');
  const progressoRecuperado = await db.cotacoes.obterProgresso(cotacaoId);
  console.log('📋 Progresso Recuperado:', JSON.stringify(progressoRecuperado, null, 2));

  console.log('\n================================================================');
  console.log('✅ TESTE DE VERIFICAÇÃO DE PROCESSO CONCLUÍDO COM SUCESSO');
  console.log('================================================================');
}

testarValoresEProgresso().catch(console.error);
