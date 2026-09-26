import { supabase } from '../lib/db/client';

async function cleanupTestQuote() {
  const testId = '964ce43c-49e8-4781-85a4-2f87e6bc5e20';
  console.log(`[CLEANUP] Limpando cotação de teste ID: ${testId}...`);

  if (!supabase) {
    console.error('Supabase não disponível.');
    return;
  }

  try { await supabase.from('cotacao_itens').delete().eq('cotacao_id', testId); } catch (e) {}
  try { await supabase.from('itens_cotacao_fornecedor').delete().eq('cotacao_id', testId); } catch (e) {}
  try { await supabase.from('cotacao_fornecedor_sessoes').delete().eq('cotacao_id', testId); } catch (e) {}
  const { error } = await supabase.from('cotacoes').delete().eq('id', testId);

  if (error) {
    console.error('Erro ao deletar cotação de teste:', error.message);
  } else {
    console.log('✅ Cotação de teste de ID 964ce43c-49e8-4781-85a4-2f87e6bc5e20 removida com sucesso!');
  }
}

cleanupTestQuote().catch(console.error);
