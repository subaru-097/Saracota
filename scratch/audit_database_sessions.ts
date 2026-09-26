import { supabase } from '../lib/db/client';

async function auditDatabaseSessions() {
  console.log('=== AUDITORIA DIRECTA NO SUPABASE DA TABELA cotacao_fornecedor_sessoes ===\n');

  if (!supabase) {
    console.log('Supabase não configurado via client.ts');
    return;
  }

  const { data: sessoes, error } = await supabase
    .from('cotacao_fornecedor_sessoes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao consultar cotacao_fornecedor_sessoes:', error);
    return;
  }

  console.log(`Encontradas ${sessoes?.length || 0} sessões gravadas no banco.\n`);

  for (const s of sessoes || []) {
    console.log('----------------------------------------------------');
    console.log(`ID / Primary Key: ${s.id || 'N/A'}`);
    console.log(`Cotacao ID: ${s.cotacao_id}`);
    console.log(`Fornecedor ID: ${s.fornecedor_id}`);
    console.log(`Status: ${s.status}`);
    console.log(`Updated At / Timestamp: ${s.updated_at || s.created_at}`);
    console.log(`Payload (browserbase_session_id):`);
    try {
      const parsed = JSON.parse(s.browserbase_session_id);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(s.browserbase_session_id);
    }
  }
}

auditDatabaseSessions().catch(console.error);
