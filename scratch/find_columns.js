const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function discoverColumns() {
  const uuid = crypto.randomUUID();

  // Test minimalist insert in cotacoes
  console.log('--- Test cotacoes minimal ---');
  const { data: c1, error: e1 } = await supabase.from('cotacoes').insert([{ id: uuid }]).select();
  console.log('Result minimal insert cotacoes:', c1, e1);

  // Test minimalist insert in cotacao_itens
  console.log('\n--- Test cotacao_itens minimal ---');
  const { data: c2, error: e2 } = await supabase.from('cotacao_itens').insert([{ cotacao_id: uuid }]).select();
  console.log('Result minimal insert cotacao_itens:', c2, e2);
}

discoverColumns();
