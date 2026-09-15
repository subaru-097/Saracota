const { supabase } = require('../lib/db/client');
const crypto = require('crypto');

async function testItensCotacao() {
  const uuid = crypto.randomUUID();

  console.log('--- Testing insert into itens_cotacao ---');
  const { data: d1, error: e1 } = await supabase
    .from('itens_cotacao')
    .insert([{
      cotacao_id: uuid,
      material: 'CABO FLEX 100M COBRECOM 2,50MM AM',
      quantidade: 5,
      preco_unitario: 235.16,
      unidade: 'un',
      categoria: 'eletrica'
    }])
    .select();

  console.log('itens_cotacao Insert Data:', d1);
  console.log('itens_cotacao Insert Error:', e1);

  if (d1 && d1.length > 0) {
    console.log('✅ SUCCESS! KEYS of itens_cotacao:', Object.keys(d1[0]));
    await supabase.from('itens_cotacao').delete().eq('cotacao_id', uuid);
  }
}

testItensCotacao().catch(console.error);
