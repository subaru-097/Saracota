import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '@/lib/db/client';

async function main() {
  if (!supabase) return;

  const { data: fornList } = await supabase.from('fornecedores').select('*');
  const cofema = fornList?.find(f => f.nome.toLowerCase().includes('cofema'));

  if (!cofema) {
    console.error('Cofema não encontrado no Supabase DB!');
    return;
  }

  console.log('Cofema ID:', cofema.id);

  const newSeletores = {
    config_slug: 'cofema',
    rpa_ativo: true,
    url_site: 'https://www.cofema.com.br/',
    ...(cofema.seletores || {})
  };

  const { data, error } = await supabase
    .from('fornecedores')
    .update({ seletores: newSeletores })
    .eq('id', cofema.id)
    .select();

  if (error) {
    console.error('Erro ao atualizar seletores da Cofema:', error);
  } else {
    console.log('Seletores da Cofema atualizados com sucesso:', data);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
