import { supabase } from '../lib/db/client';

async function activateMegaleste() {
  const { data: mega } = await supabase.from('fornecedores').select('*').eq('id', '0e75b26e-6ff7-4fb0-a783-897ca1224f48').single();
  if (mega) {
    const updatedSel = {
      ...(mega.seletores || {}),
      rpa_ativo: true,
      config_slug: 'megaleste',
      slug: 'megaleste'
    };
    await supabase.from('fornecedores').update({ seletores: updatedSel }).eq('id', '0e75b26e-6ff7-4fb0-a783-897ca1224f48');
    console.log('✅ Megaleste ativado com rpa_ativo: true!');
  }
}

activateMegaleste().catch(console.error);
