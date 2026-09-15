import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, anonKey);

async function testInsertRealUser() {
  const realUserId = '61ab64e4-c2cb-46df-bb14-6cc326293085';

  const payload = {
    user_id: realUserId,
    fornecedores_selecionados: ['33e03495-100d-45a3-9e34-899de56b0ab1'],
    itens: [
      {
        material: "CAIXA DE ÁGUA FECHADA FORTLEV 310 LITROS",
        quantidade: 5,
        unidade: "un",
        preco_unitario: 438.03,
        categoria: "hidraulica"
      },
      {
        material: "DUCHA LORENZETTI MAXI DUCHA 127V",
        quantidade: 5,
        unidade: "un",
        preco_unitario: 83.44,
        categoria: "eletrica"
      }
    ],
    status: 'pendente',
    valor_total: 2607.35
  };

  console.log('Tentando insert na tabela cotacoes com user_id real...');
  const { data, error } = await supabase.from('cotacoes').insert([payload]).select().single();

  console.log('--- RETORNO DO SUPABASE ---');
  if (error) {
    console.error('ERRO:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ SUCESSO! Registro gravado:', JSON.stringify(data, null, 2));
  }
}

testInsertRealUser();
