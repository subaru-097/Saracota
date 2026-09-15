const supabase = require('../config/supabase');
const crypto = require('crypto');

async function testCotacoesMinimal() {
  const newId = crypto.randomUUID();

  // Test inserting without fornecedor_id
  const r1 = await supabase.from('cotacoes').insert([{ id: newId }]).select();
  console.log('insert {id}:', r1);

  const r2 = await supabase.from('cotacoes').insert([{ id: crypto.randomUUID(), status: 'pendente' }]).select();
  console.log('insert {id, status}:', r2);

  const r3 = await supabase.from('cotacoes').insert([{ id: crypto.randomUUID(), valor_total: 100 }]).select();
  console.log('insert {id, valor_total}:', r3);
}

testCotacoesMinimal();
