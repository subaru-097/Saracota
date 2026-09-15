const supabase = require('../config/supabase');

(async () => {
  console.log('--- TESTANDO TABELAS DO SUPABASE ---');

  // 1. cotacoes
  const { data: cotData, error: cotErr } = await supabase.from('cotacoes').select('*').limit(1);
  console.log('\nTabela cotacoes:');
  console.log('Data:', cotData);
  console.log('Error:', cotErr);

  // 2. cotacao_itens
  const { data: itemData, error: itemErr } = await supabase.from('cotacao_itens').select('*').limit(1);
  console.log('\nTabela cotacao_itens:');
  console.log('Data:', itemData);
  console.log('Error:', itemErr);

  // 3. cotacao_fornecedor_sessoes
  const { data: sessData, error: sessErr } = await supabase.from('cotacao_fornecedor_sessoes').select('*').limit(1);
  console.log('\nTabela cotacao_fornecedor_sessoes:');
  console.log('Data:', sessData);
  console.log('Error:', sessErr);

})();
