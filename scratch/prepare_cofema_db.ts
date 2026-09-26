import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '@/lib/db/client';

async function main() {
  if (!supabase) {
    console.error('Supabase client não configurado');
    return;
  }

  const { data, error } = await supabase
    .from('fornecedores')
    .update({
      config_slug: 'cofema',
      rpa_ativo: true
    })
    .eq('id', '752e18bd-4f41-414a-8f66-0d8f538de99e')
    .select();

  if (error) {
    console.error('Erro ao atualizar Cofema no DB:', error);
  } else {
    console.log('Cofema atualizado com sucesso no Supabase DB:', data);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
