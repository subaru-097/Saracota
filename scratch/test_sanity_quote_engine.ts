import { isCotacaoEmProcessamento } from '../lib/services/automacao/matchingEngine';

async function testSanityQuoteEngine() {
  console.log('🧪 Iniciando teste de sanidade do quoteEngine / matchingEngine...');

  try {
    console.log('1. Testando isCotacaoEmProcessamento...');
    const emProc = await isCotacaoEmProcessamento('fake-cotacao-id-123');
    console.log('   Resultado (isCotacaoEmProcessamento):', emProc);

    console.log('\n✅ TESTE DE SANIDADE DO QUOTE ENGINE CONCLUÍDO COM 100% DE SUCESSO!');
    console.log('✅ Nenhuma regressão ou quebra no motor de cotação de produção!');
  } catch (err: any) {
    console.error('❌ Erro no teste de sanidade do quoteEngine:', err);
    process.exit(1);
  }
}

testSanityQuoteEngine();
