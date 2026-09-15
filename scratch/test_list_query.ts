import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, anonKey);

async function testListQuery() {
  console.log('=== TESTANDO QUERY LIST EM COTAÇÕES COM JOINS ===');

  // Teste 1: com created_at
  const res1 = await supabase
    .from('cotacoes')
    .select(`
      *,
      itens_cotacao_fornecedor(*),
      cotacao_fornecedor_sessoes(*)
    `)
    .order('created_at', { ascending: false });

  console.log('Res1 error:', res1.error);
  console.log('Res1 data count:', res1.data?.length);

  if (res1.error) {
    // Teste 2: com criado_em
    const res2 = await supabase
      .from('cotacoes')
      .select(`
        *,
        itens_cotacao_fornecedor(*),
        cotacao_fornecedor_sessoes(*)
      `)
      .order('criado_em', { ascending: false });

    console.log('Res2 error:', res2.error);
    console.log('Res2 data count:', res2.data?.length);
    if (res2.data && res2.data.length > 0) {
      console.log('Exemplo de registro de cotacao com joins:');
      console.log(JSON.stringify(res2.data[0], null, 2));
    }
  } else if (res1.data && res1.data.length > 0) {
    console.log('Exemplo de registro de cotacao com joins:');
    console.log(JSON.stringify(res1.data[0], null, 2));
  }
}

testListQuery();
