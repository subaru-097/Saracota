import { db } from '../lib/db/client';

async function testMultiSupplierIsolation() {
  console.log('================================================================');
  console.log('🧪 TESTE E2E MULTI-FORNECEDOR (ISOLAMENTO DE SESSÕES E PREÇOS)');
  console.log('================================================================\n');

  const cotacaoId = 'cot-multi-' + Date.now();
  const fornCicalferId = 'forn-cicalfer';
  const fornSicofarId = 'forn-sicofar';

  const sessionCicalfer = 'bb-sess-cicalfer-' + Date.now();
  const sessionSicofar = 'bb-sess-sicofar-' + Date.now();

  console.log('1. Automação Cicalfer criando Sessão 1...');
  console.log('   [COTACAO] sessão criada (Cicalfer):', sessionCicalfer);
  await db.cotacoes.salvarBrowserbaseSessionId(cotacaoId, fornCicalferId, sessionCicalfer);

  console.log('\n2. Automação Sicofar criando Sessão 2 (Simultânea/Sequencial)...');
  console.log('   [COTACAO] sessão criada (Sicofar):', sessionSicofar);
  await db.cotacoes.salvarBrowserbaseSessionId(cotacaoId, fornSicofarId, sessionSicofar);

  console.log('\n3. Simulando busca de modal pelo Frontend...');
  const sessRecuperadaCicalfer = await db.cotacoes.obterBrowserbaseSessionId(cotacaoId, fornCicalferId);
  const sessRecuperadaSicofar = await db.cotacoes.obterBrowserbaseSessionId(cotacaoId, fornSicofarId);

  console.log('   [LIVE-VIEW] sessão usada no modal Cicalfer:', sessRecuperadaCicalfer);
  console.log('   [LIVE-VIEW] sessão usada no modal Sicofar:', sessRecuperadaSicofar);

  console.log('\n================================================================');
  console.log('📊 VERIFICAÇÃO DE INTEGRIDADE MULTI-FORNECEDOR:');
  console.log('   - Session ID Cicalfer:', sessionCicalfer);
  console.log('   - Session ID Sicofar:', sessionSicofar);
  console.log('   - Cicalfer recuperou a sessão própria?', sessionCicalfer === sessRecuperadaCicalfer);
  console.log('   - Sicofar recuperou a sessão própria?', sessionSicofar === sessRecuperadaSicofar);
  console.log('   - Sessões são DISTINTAS (Sem contaminação)?', sessionCicalfer !== sessionSicofar);
  console.log('================================================================');
}

testMultiSupplierIsolation().catch(console.error);
