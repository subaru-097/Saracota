require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('URL ou Chave do Supabase não encontrada.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function ativarConstruja() {
  console.log('1. Executando UPDATE para ativar RPA no fornecedor Construjá...');

  const { data, error } = await supabase
    .from('fornecedores')
    .update({
      rpa_ativo: true,
      config_slug: 'construja'
    })
    .or('nome.ilike.%construja%,id.eq.a1684c4d-d896-4ba9-a591-cda455c5ffe2')
    .select('*');

  if (error) {
    console.error('Erro ao atualizar fornecedor no Supabase:', error.message);
  } else {
    console.log('✅ Atualização realizada com sucesso!');
    console.log('Resultado do fornecedor ativado:');
    console.log(JSON.stringify(data, null, 2));
  }
}

ativarConstruja();
