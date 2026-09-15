const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsertUUID() {
  const testUuid = crypto.randomUUID();
  console.log('Testing UUID:', testUuid);

  console.log('\n--- Trying INSERT into cotacoes ---');
  const { data: cData, error: cErr } = await supabase
    .from('cotacoes')
    .insert([
      {
        id: testUuid,
        status: 'em_analise',
        valor_total: 3107.84,
        observacoes: 'Teste cotação 4 itens'
      }
    ])
    .select();
  
  console.log('cotacoes INSERT result:', cData, 'Error:', cErr);

  console.log('\n--- Trying INSERT into cotacao_itens ---');
  const { data: iData, error: iErr } = await supabase
    .from('cotacao_itens')
    .insert([
      {
        cotacao_id: testUuid,
        fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
        material: 'CABO FLEX 100M COBRECOM 2,50MM',
        quantidade: 2,
        preco: 235.16
      }
    ])
    .select();

  console.log('cotacao_itens INSERT result:', iData, 'Error:', iErr);
}

testInsertUUID();
