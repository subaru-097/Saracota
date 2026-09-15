const supabase = require('../config/supabase');

async function testItensCotacaoFornecedor() {
  console.log('--- TESTING ITENS_COTACAO_FORNECEDOR ---');
  const cotacaoId = 'cot-cicalfer-test-' + Date.now();
  const fornecedorId = '33e03495-100d-45a3-9e34-899de56b0ab1';

  const records = [
    {
      cotacao_id: cotacaoId,
      fornecedor_id: fornecedorId,
      material: 'CABO FLEX 100M COBRECOM 2,50MM',
      produto_encontrado: 'CABO FLEX 100M COBRECOM 2,50MM AM REF: 10672',
      preco_unitario: 235.16,
      quantidade: 5,
      total: 1175.80,
      confianca_percent: 100,
      status_matching: 'CONFIRMADO'
    },
    {
      cotacao_id: cotacaoId,
      fornecedor_id: fornecedorId,
      material: 'Broxa Roma Retangular 15,5 x 5,5cm',
      produto_encontrado: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM REF: 11992',
      preco_unitario: 4.71,
      quantidade: 12,
      total: 56.52,
      confianca_percent: 100,
      status_matching: 'CONFIRMADO'
    },
    {
      cotacao_id: cotacaoId,
      fornecedor_id: fornecedorId,
      material: 'Alicate Bico Chato MTX 6',
      produto_encontrado: 'ALICATE BICO CHATO MTX 6 REF: 13329',
      preco_unitario: 20.56,
      quantidade: 12,
      total: 246.72,
      confianca_percent: 100,
      status_matching: 'CONFIRMADO'
    }
  ];

  const res = await supabase.from('itens_cotacao_fornecedor').insert(records).select();
  console.log('itens_cotacao_fornecedor result:', JSON.stringify(res, null, 2));
}

testItensCotacaoFornecedor();
