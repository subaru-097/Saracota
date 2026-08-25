const supabase = require('./config/supabase');

async function testarSupabase() {
  console.log('====================================================');
  console.log('🚀 TESTE DE CONEXÃO E TABELAS NO BANCO SUPABASE');
  console.log('====================================================');

  // 1. SELECT na tabela fornecedores
  console.log('\n📡 1. Executando SELECT na tabela "fornecedores"...');
  const { data: fornData, error: fornError } = await supabase
    .from('fornecedores')
    .select('*');

  if (fornError) {
    console.error('❌ Erro no SELECT em "fornecedores":', fornError);
  } else {
    console.log('✅ SELECT bem-sucedido na tabela "fornecedores"! Registros:', fornData.length);
  }

  // 2. SELECT na tabela fornecedores_login
  console.log('\n📡 2. Executando SELECT na tabela "fornecedores_login"...');
  const { data: loginData, error: loginError } = await supabase
    .from('fornecedores_login')
    .select('*');

  if (loginError) {
    console.error('❌ Aviso na tabela "fornecedores_login":', loginError.message);
  } else {
    console.log('✅ SELECT bem-sucedido na tabela "fornecedores_login"! Registros:', loginData.length);
  }

  // 3. Teste de INSERT na tabela fornecedores
  console.log('\n📝 3. Executando INSERT de teste na tabela "fornecedores"...');
  const { data: insertForn, error: errInsertForn } = await supabase
    .from('fornecedores')
    .insert([{ nome: 'Construjá Teste RLS' }])
    .select();

  if (errInsertForn) {
    console.error('⚠️ Resultado do INSERT:', errInsertForn.message);
    if (errInsertForn.code === '42501') {
      console.log('💡 DIAGNÓSTICO RLS: A tabela "fornecedores" existe, mas exige permissão/política RLS para INSERT anônimo.');
    }
  } else {
    console.log('🎉 INSERT REALIZADO COM SUCESSO! ID:', insertForn[0].id);
  }

  console.log('\n====================================================');
  console.log('🏁 TESTE CONCLUÍDO COM SUCESSO');
  console.log('====================================================');
}

testarSupabase();
