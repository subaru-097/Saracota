require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Using Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSuppliers() {
  console.log('\n📡 CONSULTANDO BANCO REAL SUPABASE...');
  const { data, error } = await supabase.from('fornecedores').select('*');
  
  if (error) {
    console.error('❌ Erro no SELECT:', error);
    return;
  }

  console.log(`\n🎉 ENCONTRADOS ${data.length} FORNECEDORES NO BANCO REAL SUPABASE:\n`);
  
  data.forEach((f, idx) => {
    console.log(`--- [Fornecedor ${idx + 1}] ---`);
    console.log(`ID: ${f.id}`);
    console.log(`Nome: ${f.nome}`);
    console.log(`Categoria: ${f.categoria || 'N/A'}`);
    console.log(`URL Login/Site: ${f.url_login || f.url_site || f.urlPortalB2B || 'N/A'}`);
    console.log(`Login Salvo: ${f.login_salvo || f.email_login || 'N/A'}`);
    console.log(`Senha Criptografada Presente?: ${Boolean(f.senha_criptografada || f.senha_login)}`);
    console.log(`Coluna "seletores" (JSONB) Preenchida?: ${Boolean(f.seletores && Object.keys(f.seletores).length > 0)}`);
    if (f.seletores) {
      console.log(`Seletores JSONB:`, JSON.stringify(f.seletores, null, 2));
    } else {
      console.log(`Seletores JSONB: null / ausente`);
    }
    console.log('--------------------------------------------------\n');
  });
}

checkSuppliers().catch(console.error);
