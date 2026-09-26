import { supabase } from '../lib/db/client';

async function activateMercadaoRpa() {
  console.log('=== ATIVANDO BADGE RPA AUTÔNOMO ATIVO PARA MERCADÃO LOJISTA ===');
  if (!supabase) throw new Error('Supabase não disponível');

  const { data: mercadao } = await supabase
    .from('fornecedores')
    .select('*')
    .eq('id', 'a4042203-b504-4a82-af41-8ffa19ae24a6')
    .single();

  if (!mercadao) throw new Error('Mercadão Lojista não encontrado no DB');

  const currentSeletores = mercadao.seletores || {};
  const updatedSeletores = {
    ...currentSeletores,
    rpa_ativo: true,
    config_slug: 'mercadao-lojista',
    slug: 'mercadao-lojista'
  };

  const { error } = await supabase
    .from('fornecedores')
    .update({
      seletores: updatedSeletores,
      updated_at: new Date().toISOString()
    })
    .eq('id', 'a4042203-b504-4a82-af41-8ffa19ae24a6');

  if (error) {
    console.error('Erro ao atualizar seletores no Supabase:', error.message);
  } else {
    console.log('✅ Mercadão Lojista atualizado no Supabase com rpa_ativo: true e config_slug: "mercadao-lojista"!');
  }
}

activateMercadaoRpa().catch(console.error);
