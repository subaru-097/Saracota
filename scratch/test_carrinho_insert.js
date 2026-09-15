const supabase = require('../config/supabase');

async function testCarrinhoInsert() {
  console.log('--- TESTING COTACOES_CARRINHO & SESSÕES ---');

  // 1. Test cotacao_fornecedor_sessoes with browserbase_session_id
  const testCotacaoId = 'cot-cicalfer-test-' + Date.now();
  const resSess = await supabase.from('cotacao_fornecedor_sessoes').insert([{
    cotacao_id: testCotacaoId,
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    browserbase_session_id: 'session-cicalfer-rpa-' + Date.now(),
    status: 'carrinho_pronto'
  }]).select();
  console.log('cotacao_fornecedor_sessoes result:', JSON.stringify(resSess, null, 2));

  // 2. Test cotacoes_carrinho
  const resCarrinho = await supabase.from('cotacoes_carrinho').insert([{
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    fornecedor_nome: 'Cicalfer',
    valor_total: 1479.04,
    status: 'concluido'
  }]).select();
  console.log('cotacoes_carrinho result:', JSON.stringify(resCarrinho, null, 2));
}

testCarrinhoInsert();
