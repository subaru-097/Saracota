const supabase = require('../config/supabase');

async function testInsert() {
  console.log('Testing insert into cotacoes...');
  
  // Test 1: Insert with status and valor_total
  const res1 = await supabase.from('cotacoes').insert([{ status: 'concluida', valor_total: 1479.04 }]).select();
  console.log('Insert res1:', res1);

  // Test 2: Insert into logs_automacao
  const res2 = await supabase.from('logs_automacao').insert([{
    fornecedor_name: 'Cicalfer',
    status: 'sucesso',
    detalhes: JSON.stringify({ total: 1479.04, itensCount: 3 })
  }]).select();
  console.log('Insert res2 (logs_automacao):', res2);
}

testInsert();
