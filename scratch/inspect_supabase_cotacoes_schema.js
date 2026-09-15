const { supabase } = require('../lib/db/client');
const crypto = require('crypto');

async function testUuidInsert() {
  const uuid = crypto.randomUUID();
  console.log(`Testing INSERT into cotacoes with valid UUID: ${uuid}`);

  const { data: insData, error: insErr } = await supabase
    .from('cotacoes')
    .insert([{ id: uuid, status: 'pendente', valor_total: 150.50 }])
    .select();

  console.log('INSERT Data:', insData);
  console.log('INSERT Error:', insErr);

  if (insData && insData.length > 0) {
    await supabase.from('cotacoes').delete().eq('id', uuid);
    console.log('Cleaned up test row.');
  }

  // Also test inserting WITHOUT id (letting default gen_random_uuid() generate it)
  const { data: insData2, error: insErr2 } = await supabase
    .from('cotacoes')
    .insert([{ status: 'pendente', valor_total: 250.75 }])
    .select();

  console.log('\nINSERT without ID Data:', insData2);
  console.log('INSERT without ID Error:', insErr2);

  if (insData2 && insData2.length > 0) {
    await supabase.from('cotacoes').delete().eq('id', insData2[0].id);
    console.log('Cleaned up test row 2.');
  }
}

testUuidInsert().catch(console.error);
