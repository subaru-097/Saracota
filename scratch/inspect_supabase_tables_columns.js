const { supabase } = require('../lib/db/client');

async function inspectTables() {
  console.log('--- Inspecting cotacoes ---');
  const r1 = await supabase.from('cotacoes').select('*').limit(1);
  console.log('cotacoes select:', r1);

  console.log('\n--- Inspecting cotacao_itens ---');
  const r2 = await supabase.from('cotacao_itens').select('*').limit(1);
  console.log('cotacao_itens select:', r2);

  console.log('\n--- Inspecting itens_cotacao_fornecedor ---');
  const r3 = await supabase.from('itens_cotacao_fornecedor').select('*').limit(1);
  console.log('itens_cotacao_fornecedor select:', r3);

  console.log('\n--- Inspecting cotacao_fornecedor_sessoes ---');
  const r4 = await supabase.from('cotacao_fornecedor_sessoes').select('*').limit(1);
  console.log('cotacao_fornecedor_sessoes select:', r4);
}

inspectTables().catch(console.error);
