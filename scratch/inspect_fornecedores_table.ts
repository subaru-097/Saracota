import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '@/lib/db/client';

async function main() {
  if (!supabase) return;

  const { data, error } = await supabase.from('fornecedores').select('*').limit(1);
  if (error) {
    console.error('Erro ao buscar fornecedores:', error);
  } else if (data && data.length > 0) {
    console.log('Colunas de fornecedores:', Object.keys(data[0]));
    console.log('Registro Cofema atual:', data.find(f => f.nome.toLowerCase().includes('cofema')) || data[0]);
  }
}

main().then(() => process.exit(0));
