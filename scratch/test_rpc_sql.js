const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('Testing RPC calls on Supabase...');

  const rpcNames = ['exec_sql', 'exec', 'execute_sql', 'sql', 'run_sql'];

  for (const name of rpcNames) {
    const { data, error } = await supabase.rpc(name, { sql: 'SELECT 1;' });
    console.log(`RPC "${name}":`, data, error ? error.message : 'SUCCESS');
  }
})();
