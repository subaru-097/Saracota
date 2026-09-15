const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Using Key prefix:', supabaseKey ? supabaseKey.substring(0, 15) : 'NONE');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const testId = 'cot-test-' + Date.now();
  console.log('\n--- 1. Testing INSERT into cotacoes ---');
  const { data: cData, error: cErr } = await supabase
    .from('cotacoes')
    .insert([
      {
        id: testId,
        data_criacao: new Date().toISOString(),
        status: 'rascunho',
        valor_total: 3107.84,
        observacoes: 'Teste RLS'
      }
    ])
    .select();

  if (cErr) {
    console.error('❌ Erro no INSERT cotacoes:', cErr);
  } else {
    console.log('✅ Sucesso no INSERT cotacoes:', cData);
  }

  console.log('\n--- 2. Testing INSERT into cotacao_itens ---');
  const { data: iData, error: iErr } = await supabase
    .from('cotacao_itens')
    .insert([
      {
        cotacao_id: testId,
        fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
        nome: 'CABO FLEX 100M COBRECOM 2,50MM',
        preco_unitario: 235.16,
        quantidade: 2,
        status: 'confirmado'
      }
    ])
    .select();

  if (iErr) {
    console.error('❌ Erro no INSERT cotacao_itens:', iErr);
  } else {
    console.log('✅ Sucesso no INSERT cotacao_itens:', iData);
  }

  console.log('\n--- 3. Testing UPSERT into cotacao_fornecedor_sessoes ---');
  const { data: sData, error: sErr } = await supabase
    .from('cotacao_fornecedor_sessoes')
    .upsert(
      {
        cotacao_id: testId,
        fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
        browserbase_session_id: JSON.stringify({ test: true }),
        status: 'carrinho_pronto'
      },
      { onConflict: 'cotacao_id,fornecedor_id' }
    )
    .select();

  if (sErr) {
    console.error('❌ Erro no UPSERT cotacao_fornecedor_sessoes:', sErr);
  } else {
    console.log('✅ Sucesso no UPSERT cotacao_fornecedor_sessoes:', sData);
  }

  console.log('\n--- 4. SELECT Query Verification ---');
  const { data: selData, error: selErr } = await supabase
    .from('cotacao_itens')
    .select('*')
    .eq('cotacao_id', testId);
  console.log('SELECT cotacao_itens result:', selData, selErr);
}

testInsert();
