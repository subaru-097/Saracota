const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAllTables() {
  const testId = 'cot-' + Date.now();
  console.log('--- Testing cotacao_fornecedor_sessoes ---');
  const { data: sData, error: sErr } = await supabase
    .from('cotacao_fornecedor_sessoes')
    .upsert({
      cotacao_id: testId,
      fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
      browserbase_session_id: JSON.stringify({
        cotacao_id: testId,
        fornecedor: 'Cicalfer',
        total: 3107.84,
        itens: [
          { nome: 'CABO FLEX 100M COBRECOM 2,50MM', qtd: 2, total: 470.32 },
          { nome: 'DUCHA LORENZETTI BELLA DUCHA 127V', qtd: 5, total: 421.45 },
          { nome: 'CARRINHO DE MÃO ESFERA EXTRA FORTE 60 LTS', qtd: 5, total: 1108.95 },
          { nome: 'DUCHA LORENZETTI TOP JET MULTI 127V', qtd: 7, total: 1102.22 }
        ]
      }),
      status: 'carrinho_pronto',
      updated_at: new Date().toISOString()
    })
    .select();

  console.log('cotacao_fornecedor_sessoes RESULT:', sData, sErr);

  console.log('\n--- Querying saved record from cotacao_fornecedor_sessoes ---');
  const { data: qData, error: qErr } = await supabase
    .from('cotacao_fornecedor_sessoes')
    .select('*')
    .eq('cotacao_id', testId);

  console.log('SELECT result:', JSON.stringify(qData, null, 2), qErr);
}

testAllTables();
