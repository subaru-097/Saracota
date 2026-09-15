const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vugpmsvyghgawskivdnu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanAndPrepDb() {
  console.log('=== 1. PURGANDO / EXPIRANDO COTAÇÕES ANTIGAS NO BANCO DE DADOS ===');
  
  // 1. Expirar cotações ativas no banco para garantir que a UI comece sem itens residuais
  const { data: updatedQuotes, error: errUpdate } = await supabase
    .from('cotacoes')
    .update({ status: 'expirada' })
    .in('status', ['pendente', 'em_analise', 'rascunho'])
    .select();

  if (errUpdate) {
    console.warn('⚠️ Aviso ao expirar cotações no Supabase:', errUpdate.message);
  } else {
    console.log(`✅ ${updatedQuotes ? updatedQuotes.length : 0} cotações marcadas como 'expirada' no Supabase.`);
  }

  // 2. Verificar o cadastro do fornecedor Cicalfer no banco
  console.log('\n=== 2. AUDITANDO CADASTRO DO FORNECEDOR CICALFER ===');
  const { data: fornecedores, error: errForn } = await supabase
    .from('fornecedores')
    .select('*');

  if (errForn) {
    console.warn('⚠️ Erro ao consultar fornecedores:', errForn.message);
  } else if (fornecedores) {
    const cicalfer = fornecedores.find(f => f.nome.toLowerCase().includes('cicalfer') || f.id === '33e03495-100d-45a3-9e34-899de56b0ab1');
    if (cicalfer) {
      console.log(`✅ Cicalfer localizado no banco (ID: ${cicalfer.id}):`);
      console.log(`   - Nome: ${cicalfer.nome}`);
      console.log(`   - URL Site: ${cicalfer.url_site || cicalfer.urlPortalB2B || 'N/A'}`);
      console.log(`   - E-mail Login: ${cicalfer.email_login || cicalfer.login_salvo || 'N/A'}`);
      
      // Garantir que a URL do site seja cicalfer.com.br
      if (!cicalfer.url_site || cicalfer.url_site.includes('secofair') || cicalfer.url_site.includes('seekoffer')) {
        console.log('   -> Atualizando URL do site para https://www.cicalfer.com.br ...');
        await supabase
          .from('fornecedores')
          .update({ url_site: 'https://www.cicalfer.com.br', url_login: 'https://www.cicalfer.com.br' })
          .eq('id', cicalfer.id);
        console.log('   ✅ URL da Cicalfer corrigida no Supabase!');
      }
    } else {
      console.log('ℹ️ Cicalfer não localizado na tabela fornecedores do Supabase (será usado fallback configurado no client.ts).');
    }
  }

  console.log('\n=== LIMPEZA E PREPARAÇÃO CONCLUÍDAS COM SUCESSO ===');
}

cleanAndPrepDb().catch(err => {
  console.error('❌ Erro na execução da limpeza do banco:', err);
  process.exit(1);
});
