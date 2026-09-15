const supabase = require('../config/supabase');

async function queryDbRecord() {
  console.log('=== QUERY 1: RECORD ID 8bda1098-8556-4c87-8592-7d7f551d0944 ===');
  const res1 = await supabase
    .from('cotacao_fornecedor_sessoes')
    .select('*')
    .eq('id', '8bda1098-8556-4c87-8592-7d7f551d0944');
  console.log(JSON.stringify(res1.data, null, 2));

  console.log('\n=== QUERY 2: UI TRIGGERED RECORD ID cca5f628-1a0a-44ba-859f-ab10cc8471cf ===');
  const res2 = await supabase
    .from('cotacao_fornecedor_sessoes')
    .select('*')
    .eq('id', 'cca5f628-1a0a-44ba-859f-ab10cc8471cf');
  console.log(JSON.stringify(res2.data, null, 2));
}

queryDbRecord();
