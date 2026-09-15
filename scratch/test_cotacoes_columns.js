const supabase = require('../config/supabase');

async function checkCotacoesColumns() {
  console.log('Testing cotacoes insert variations...');

  const c1 = await supabase.from('cotacoes').insert([{ status: 'concluida' }]).select();
  console.log('insert {status}:', c1);

  const c2 = await supabase.from('cotacoes').insert([{ id: 'cot-test-' + Date.now() }]).select();
  console.log('insert {id}:', c2);

  const c3 = await supabase.from('cotacoes').select('*');
  console.log('select * from cotacoes:', c3);
}

checkCotacoesColumns();
