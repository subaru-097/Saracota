import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, anonKey);

async function inspectSchema() {
  console.log('=== INSPEÇÃO DE TABELAS E RLS NO SUPABASE ===');

  // Listar tabelas públicas testando SELECT em tabelas conhecidas
  const tables = ['cotacoes', 'cotacao_itens', 'itens_cotacao', 'itens_cotacao_fornecedor', 'fornecedores', 'produtos', 'projetos', 'usuarios', 'profiles'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Tabela "${t}": ERRO (${error.code} - ${error.message})`);
    } else {
      console.log(`Tabela "${t}": OK (Linhas encontradas: ${data.length})`);
      if (data.length > 0) {
        console.log(`  └─ Colunas: ${Object.keys(data[0]).join(', ')}`);
      }
    }
  }
}

inspectSchema();
