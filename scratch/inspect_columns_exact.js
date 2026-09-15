const { supabase } = require('../lib/db/client');
const crypto = require('crypto');

async function inspectExactColumns() {
  const uuid = crypto.randomUUID();

  // Test insert into cotacoes
  console.log('--- Testing insert into cotacoes ---');
  const { data: cotData, error: cotErr } = await supabase
    .from('cotacoes')
    .insert([{ id: uuid, status: 'pendente', valor_total: 99.99 }])
    .select();

  console.log('cotacoes insert data:', cotData);
  console.log('cotacoes insert error:', cotErr);

  // Test insert into cotacao_itens
  console.log('\n--- Testing insert into cotacao_itens ---');
  const { data: itemData, error: itemErr } = await supabase
    .from('cotacao_itens')
    .insert([{
      cotacao_id: uuid,
      fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
      nome: 'CABO FLEX 100M COBRECOM 2,50MM AM',
      preco_unitario: 235.16,
      quantidade: 5,
      total_item: 1175.80
    }])
    .select();

  console.log('cotacao_itens insert data:', itemData);
  console.log('cotacao_itens insert error:', itemErr);

  // Clean up
  await supabase.from('cotacao_itens').delete().eq('cotacao_id', uuid);
  await supabase.from('cotacoes').delete().eq('id', uuid);
}

inspectExactColumns().catch(console.error);
