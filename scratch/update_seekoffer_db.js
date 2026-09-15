const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function updateSeekOffer() {
  const newSeletores = {
    campo_email: 'input[name="email"]',
    campo_senha: 'input[name="password"]',
    botao_entrar: 'button[type="submit"]',
    campo_pesquisar_produto: 'input[type="search"]',
    botao_abrir_login: 'a:has-text("Login")'
  };

  const { data, error } = await supabase
    .from('fornecedores')
    .update({ seletores: newSeletores })
    .eq('id', '5f884210-9e12-4c22-921a-8c5e9b7722bb')
    .select();

  console.log('Update result:', JSON.stringify({ data, error }, null, 2));
}

updateSeekOffer().catch(console.error);
