const supabase = require('../config/supabase');
const crypto = require('crypto');

(async () => {
  const testId = crypto.randomUUID();
  console.log('Testing insert into cotacoes with exact schema columns (id, valor_total, status)...');

  const { data, error } = await supabase.from('cotacoes').insert([
    {
      id: testId,
      valor_total: 3107.84,
      status: 'concluido'
    }
  ]).select();

  console.log('Insert Data:', data);
  console.log('Insert Error:', error);

  const { data: selData, error: selErr } = await supabase.from('cotacoes').select('*').eq('id', testId);
  console.log('\nSelect Data:', selData);
  console.log('Select Error:', selErr);
})();
