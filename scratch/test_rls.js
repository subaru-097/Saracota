const supabase = require('../config/supabase');

async function testRls() {
  const dummyUuid = '00000000-0000-0000-0000-000000000001';

  console.log('Test 1: with user_id');
  const t1 = await supabase.from('cotacoes').insert([{ user_id: dummyUuid, valor_total: 100 }]).select();
  console.log('t1:', t1);

  console.log('Test 2: with status and user_id');
  const t2 = await supabase.from('cotacoes').insert([{ user_id: dummyUuid, status: 'pendente', valor_total: 100 }]).select();
  console.log('t2:', t2);

  console.log('Test 3: cotacao_fornecedor_sessoes (which succeeded earlier)');
  const t3 = await supabase.from('cotacao_fornecedor_sessoes').insert([{
    cotacao_id: dummyUuid,
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    browserbase_session_id: 'sess-' + Date.now(),
    status: 'carrinho_pronto'
  }]).select();
  console.log('t3:', t3);
}

testRls();
