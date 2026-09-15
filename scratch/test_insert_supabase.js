const supabase = require('../config/supabase');
const crypto = require('crypto');

(async () => {
  console.log('--- TESTANDO INSERÇÃO NAS TABELAS DO SUPABASE ---');

  const testId = crypto.randomUUID();

  // Teste 1: cotacoes
  const { data: cData, error: cErr } = await supabase.from('cotacoes').insert([
    { id: testId, status: 'pendente', valor_total: 3107.84 }
  ]).select();
  console.log('\nInsert cotacoes result:');
  console.log('Data:', cData);
  console.log('Error:', cErr);

  // Teste 2: cotacao_fornecedor_sessoes
  const { data: sData, error: sErr } = await supabase.from('cotacao_fornecedor_sessoes').insert([
    {
      cotacao_id: testId,
      fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
      browserbase_session_id: JSON.stringify({ test: true }),
      status: 'carrinho_pronto'
    }
  ]).select();
  console.log('\nInsert cotacao_fornecedor_sessoes result:');
  console.log('Data:', sData);
  console.log('Error:', sErr);

  // Teste 3: cotacao_itens (testar colunas)
  const { data: iData, error: iErr } = await supabase.from('cotacao_itens').insert([
    {
      cotacao_id: testId,
      fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
      preco: 100,
      quantidade: 1,
      status: 'confirmado'
    }
  ]).select();
  console.log('\nInsert cotacao_itens result:');
  console.log('Data:', iData);
  console.log('Error:', iErr);
})();
