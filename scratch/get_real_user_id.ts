import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, anonKey);

async function getRealUser() {
  const { data: forn } = await supabase.from('fornecedores').select('*').limit(1);
  console.log('Fornecedor data:', JSON.stringify(forn, null, 2));
}

getRealUser();
