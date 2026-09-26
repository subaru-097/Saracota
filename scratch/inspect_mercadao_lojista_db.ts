import { supabase } from '../lib/db/client';

async function inspectMercadao() {
  console.log('=== INSPECCIONANDO FORNECEDOR MERCADÃO LOJISTA NO SUPABASE ===');
  if (!supabase) {
    console.error('Supabase não está configurado!');
    return;
  }
  const { data: fornecedores, error } = await supabase.from('fornecedores').select('*');
  if (error) {
    console.error('Erro ao buscar fornecedores:', error);
    return;
  }
  
  console.log('TODOS OS FORNECEDORES NO DB:', fornecedores.map((f: any) => ({ id: f.id, nome: f.nome, slug: f.slug })));

  const mercadao = fornecedores.find((f: any) => 
    f.nome?.toLowerCase().includes('mercadão') || 
    f.nome?.toLowerCase().includes('mercadao') || 
    f.slug?.toLowerCase().includes('mercadao') ||
    f.url_login?.toLowerCase().includes('mercadao')
  );

  if (mercadao) {
    console.log('FORNECEDOR MERCADÃO LOJISTA ENCONTRADO:');
    console.log(JSON.stringify(mercadao, null, 2));
  } else {
    console.log('❌ FORNECEDOR MERCADÃO LOJISTA NÃO ENCONTRADO NO DB!');
  }
}

inspectMercadao().catch(console.error);
