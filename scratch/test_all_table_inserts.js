const supabase = require('../config/supabase');

async function testAllInserts() {
  console.log('--- TESTING ALL TABLES IN SUPABASE ---');

  // Table 1: cotacoes
  const res1 = await supabase.from('cotacoes').insert([{
    status: 'concluida',
    valor_total: 1479.04,
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1'
  }]).select();
  console.log('cotacoes insert:', res1);

  // Table 2: cotacao_fornecedor_sessoes
  const res2 = await supabase.from('cotacao_fornecedor_sessoes').insert([{
    cotacao_id: '00000000-0000-0000-0000-000000000001',
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    status: 'carrinho_pronto'
  }]).select();
  console.log('cotacao_fornecedor_sessoes insert:', res2);

  // Table 3: cotacoes_rascunho
  const res3 = await supabase.from('cotacoes_rascunho').insert([{
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    status: 'concluida'
  }]).select();
  console.log('cotacoes_rascunho insert:', res3);

  // Table 4: logs_automacao
  const res4 = await supabase.from('logs_automacao').insert([{
    fornecedor_name: 'Cicalfer',
    status: 'sucesso'
  }]).select();
  console.log('logs_automacao insert:', res4);
}

testAllInserts();
