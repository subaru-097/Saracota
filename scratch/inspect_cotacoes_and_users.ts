import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, anonKey);

async function inspectTables() {
  console.log('=== INSPEÇÃO DE USERS E SCHEMA DE COTAÇÕES ===');

  // 1. Buscar um usuário existente na tabela "users"
  const { data: users, error: errUsers } = await supabase.from('users').select('*').limit(5);
  console.log('\n--- TABELA USERS ---');
  if (errUsers) {
    console.error('Erro ao buscar users:', errUsers);
  } else {
    console.log(`Usuários encontrados: ${users?.length}`);
    console.log(JSON.stringify(users, null, 2));
  }

  // 2. Buscar 1 registro da tabela "cotacoes" para ver estrutura/tipos de dados
  const { data: cotacoes, error: errCot } = await supabase.from('cotacoes').select('*').limit(1);
  console.log('\n--- TABELA COTAÇÕES (ESTRUTURA) ---');
  if (errCot) {
    console.error('Erro ao buscar cotacoes:', errCot);
  } else {
    console.log(JSON.stringify(cotacoes, null, 2));
  }
}

inspectTables();
