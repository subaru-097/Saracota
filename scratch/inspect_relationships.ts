import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, anonKey);

async function testRelationships() {
  console.log('=== TESTANDO SELEÇÃO DE RELACIONAMENTOS EM COTAÇÕES ===');

  // Teste A: cotacao_itens
  const rA = await supabase.from('cotacoes').select('*, cotacao_itens(*)');
  console.log('A (cotacao_itens):', rA.error ? rA.error.message : `OK (${rA.data?.length} cotacoes)`);

  // Teste B: cotacao_fornecedor_sessoes
  const rB = await supabase.from('cotacoes').select('*, cotacao_fornecedor_sessoes(*)');
  console.log('B (cotacao_fornecedor_sessoes):', rB.error ? rB.error.message : `OK (${rB.data?.length} cotacoes)`);

  // Teste C: ambas
  const rC = await supabase.from('cotacoes').select('*, cotacao_itens(*), cotacao_fornecedor_sessoes(*)');
  console.log('C (ambas):', rC.error ? rC.error.message : `OK (${rC.data?.length} cotacoes)`);

  if (rC.data && rC.data.length > 0) {
    console.log('\nDados de rC[0]:');
    console.log(JSON.stringify(rC.data[0], null, 2));
  }
}

testRelationships();
