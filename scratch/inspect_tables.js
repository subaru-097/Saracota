const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log('--- Inspecting cotacoes columns ---');
  const { data: cData, error: cErr } = await supabase.from('cotacoes').select('*').limit(1);
  console.log('cotacoes sample:', cData, 'Error:', cErr);

  console.log('\n--- Inspecting cotacao_itens columns ---');
  const { data: iData, error: iErr } = await supabase.from('cotacao_itens').select('*').limit(1);
  console.log('cotacao_itens sample:', iData, 'Error:', iErr);

  console.log('\n--- Inspecting itens_cotacao columns ---');
  const { data: icData, error: icErr } = await supabase.from('itens_cotacao').select('*').limit(1);
  console.log('itens_cotacao sample:', icData, 'Error:', icErr);

  console.log('\n--- Inspecting cotacao_fornecedor_sessoes columns ---');
  const { data: sData, error: sErr } = await supabase.from('cotacao_fornecedor_sessoes').select('*').limit(1);
  console.log('cotacao_fornecedor_sessoes sample:', sData, 'Error:', sErr);
}

inspectSchema();
