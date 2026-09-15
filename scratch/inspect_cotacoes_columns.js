const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('--- 1. Testing SELECT from cotacoes ---');
  const { data: selData, error: selErr } = await supabase.from('cotacoes').select('*').limit(1);
  console.log('SELECT cotacoes result:', selData, selErr);

  console.log('\n--- 2. Testing INSERT into cotacoes with valid UUID and minimalistic payload ---');
  const testUuid = crypto.randomUUID();
  const { data: insData, error: insErr } = await supabase.from('cotacoes').insert([
    {
      id: testUuid,
      status: 'concluido',
      valor_total: 3107.84
    }
  ]).select();

  console.log('INSERT cotacoes result:', insData, insErr);
})();
