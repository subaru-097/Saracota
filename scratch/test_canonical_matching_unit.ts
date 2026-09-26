import { executarMatchingEmCamadas, extrairAtributosEstruturados, gerarCanonicalId } from '../lib/services/normalizer/canonicalIdGenerator';

function testCanonicalUnit() {
  console.log('🧪 TESTE UNITÁRIO DO MOTOR DE MATCHING EM CAMADAS (CANONICAL ID & VOLTAGEM)\n');

  const solicitado220v = 'DUCHA LORENZETTI BELLA DUCHA 220V';
  const solicitado127v = 'DUCHA LORENZETTI BELLA DUCHA 127V';
  const produtoCofema220v = '300500•DUCHA LORENZETTI BELLA DUCHA 6800W 4T 220V BRANCA 7531212';

  console.log('1. Testando Solicitação 220V vs Produto Cofema 220V (SKU 300500):');
  const res220 = executarMatchingEmCamadas(solicitado220v, produtoCofema220v, '300500');
  console.log('   Resultado:', JSON.stringify(res220, null, 2));

  console.log('\n2. Testando Solicitação 127V vs Produto Cofema 220V (SKU 300500):');
  const res127 = executarMatchingEmCamadas(solicitado127v, produtoCofema220v, '300500');
  console.log('   Resultado:', JSON.stringify(res127, null, 2));

  if (res220.status === 'MATCH_EXATO' && res127.status === 'AMBIGUO_REVISAO_MANUAL') {
    console.log('\n✅ TESTE PASSOU 100%! O Motor Canônico diferencia estritamente 127V e 220V e bloqueia substituição indevida!');
  } else {
    console.error('\n❌ TESTE FALHOU! O Motor Canônico não bloqueou a voltagem divergente.');
    process.exit(1);
  }
}

testCanonicalUnit();
