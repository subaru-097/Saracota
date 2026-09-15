import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, anonKey);

async function inspectCotacoes() {
  console.log('--- TESTANDO INSERÇÃO COM USER_ID, FORNECEDORES_SELECIONADOS E ITENS ---');

  const testPayload = {
    user_id: '00000000-0000-0000-0000-000000000000',
    fornecedores_selecionados: ['33e03495-100d-45a3-9e34-899de56b0ab1'],
    itens: [{ material: 'Tubo PVC 100mm', quantidade: 2 }],
    status: 'pendente',
    valor_total: 100.00
  };

  const { data, error } = await supabase.from('cotacoes').insert([testPayload]).select();
  console.log('Resultado insert completo:');
  console.log('Error:', JSON.stringify(error, null, 2));
  console.log('Data:', data);
}

inspectCotacoes();
