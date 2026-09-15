require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cadastrarSecofair() {
  console.log('Registering Secofair supplier in Supabase database...');
  const secofairData = {
    id: '5f884210-9e12-4c22-921a-8c5e9b7722bb',
    user_id: '61ab64e4-c2cb-46df-bb14-6cc326293085',
    nome: 'Secofair',
    whatsapp: '(11) 99887-6655',
    categoria: 'ELÉTRICA',
    url_site: 'https://www.secofair.com.br',
    url_login: 'https://www.secofair.com.br',
    login_salvo: 'compras@secofair.com.br',
    senha_criptografada: 'bXlTZWNyZXRTZW5oYTEyMyE=',
    seletores: {
      campo_email: 'input[name="email"]',
      campo_senha: 'input[name="senha"]',
      botao_entrar: 'button[type="submit"]',
      campo_pesquisar_produto: 'input[type="search"]'
    }
  };

  if (supabase) {
    const { data, error } = await supabase.from('fornecedores').upsert([secofairData]).select();
    if (error) {
      console.error('Error upserting Secofair in Supabase:', error.message);
    } else {
      console.log('✅ Secofair successfully registered/updated in Supabase real database! Data:', data);
    }
  }
}

cadastrarSecofair().catch(console.error);
