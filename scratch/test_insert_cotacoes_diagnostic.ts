import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

async function testInsertDiagnostic() {
  console.log('=== TESTE DE INSERT REAL NA TABELA "cotacoes" (DIAGNÓSTICO) ===');
  console.log(`URL Supabase: ${supabaseUrl}`);
  console.log(`ANON KEY Presente? ${Boolean(anonKey)} (tamanho: ${anonKey.length})`);
  console.log(`SERVICE_ROLE KEY Presente? ${Boolean(serviceRoleKey)} (tamanho: ${serviceRoleKey.length})`);

  // 1. TESTE COM ANON KEY (Chave pública usada atualmente por lib/db/client.ts)
  console.log('\n--- 1. TESTE DE INSERT COM ANON KEY (CLIENTE PADRÃO DO APP) ---');
  const anonClient = createClient(supabaseUrl, anonKey);
  
  const testPayloadAnon = {
    status: 'pendente',
    valor_total: 123.45,
  };

  const { data: anonData, error: anonError } = await anonClient
    .from('cotacoes')
    .insert([testPayloadAnon])
    .select()
    .single();

  if (anonError) {
    console.error('❌ [ERRO ANON KEY INSERT]:');
    console.error(JSON.stringify(anonError, null, 2));
  } else {
    console.log('✅ [SUCESSO ANON KEY INSERT]:', anonData);
  }

  // 2. TESTE COM SERVICE_ROLE KEY (Chave admin com permissão total)
  console.log('\n--- 2. TESTE DE INSERT COM SERVICE_ROLE KEY (ADMIN) ---');
  if (!serviceRoleKey) {
    console.error('⚠️ SUPABASE_SERVICE_ROLE_KEY não está definida nas variáveis de ambiente!');
  } else {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const testPayloadService = {
      status: 'pendente',
      valor_total: 999.99,
    };

    const { data: serviceData, error: serviceError } = await serviceClient
      .from('cotacoes')
      .insert([testPayloadService])
      .select()
      .single();

    if (serviceError) {
      console.error('❌ [ERRO SERVICE_ROLE KEY INSERT]:');
      console.error(JSON.stringify(serviceError, null, 2));
    } else {
      console.log('✅ [SUCESSO SERVICE_ROLE KEY INSERT]:', serviceData);
    }
  }
}

testInsertDiagnostic().catch((err) => {
  console.error('Erro na execução do teste:', err);
});
