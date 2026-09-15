const supabase = require('../config/supabase');
const crypto = require('crypto');

async function testUUIDCotacoes() {
  const newId = crypto.randomUUID();
  console.log('Testing insert with valid UUID:', newId);

  // 1. Insert in cotacoes with valid UUID
  const resC = await supabase.from('cotacoes').insert([{
    id: newId,
    status: 'concluida',
    valor_total: 1479.04,
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1'
  }]).select();

  console.log('cotacoes insert result:', JSON.stringify(resC, null, 2));

  // 2. Insert into cotacao_fornecedor_sessoes
  const resSess = await supabase.from('cotacao_fornecedor_sessoes').insert([{
    cotacao_id: newId,
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    browserbase_session_id: 'rpa-session-cicalfer-' + newId,
    status: 'carrinho_pronto'
  }]).select();

  console.log('cotacao_fornecedor_sessoes insert result:', JSON.stringify(resSess, null, 2));

  // 3. Insert into itens_cotacao
  const resItens = await supabase.from('itens_cotacao').insert([
    {
      cotacao_id: newId,
      material: 'CABO FLEX 100M COBRECOM 2,50MM',
      quantidade: 5,
      preco_unitario: 235.16,
      unidade: 'un',
      categoria: 'Elétrica'
    },
    {
      cotacao_id: newId,
      material: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM',
      quantidade: 12,
      preco_unitario: 4.71,
      unidade: 'un',
      categoria: 'Pintura'
    },
    {
      cotacao_id: newId,
      material: 'ALICATE BICO CHATO MTX 6',
      quantidade: 12,
      preco_unitario: 20.56,
      unidade: 'un',
      categoria: 'Ferramentas'
    }
  ]).select();

  console.log('itens_cotacao insert result:', JSON.stringify(resItens, null, 2));
}

testUUIDCotacoes();
