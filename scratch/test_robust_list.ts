import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, anonKey);

async function testRobustList() {
  console.log('=== TESTANDO LISTAGEM ROBUSTA COM DADOS REAIS DO POSTGRES ===');

  let data: any[] = [];

  // Tentar a query fornecida com join PostgREST
  const { data: joinData, error: joinErr } = await supabase
    .from('cotacoes')
    .select(`
      *,
      itens_cotacao_fornecedor(*),
      cotacao_fornecedor_sessoes(*)
    `)
    .order('criado_em', { ascending: false });

  if (!joinErr && joinData) {
    data = joinData;
  } else {
    console.log('Join PostgREST direto não possui FK física. Buscando tabelas e combinando por cotacao_id...');
    const { data: cotData } = await supabase
      .from('cotacoes')
      .select('*')
      .order('criado_em', { ascending: false });

    if (cotData && cotData.length > 0) {
      const cotIds = cotData.map((c) => c.id);
      
      const { data: itensForn } = await supabase
        .from('cotacao_itens')
        .select('*')
        .in('cotacao_id', cotIds);

      const { data: sessoes } = await supabase
        .from('cotacao_fornecedor_sessoes')
        .select('*')
        .in('cotacao_id', cotIds);

      data = cotData.map((c) => {
        const matchingItens = (itensForn || []).filter((i) => i.cotacao_id === c.id);
        const matchingSessoes = (sessoes || []).filter((s) => s.cotacao_id === c.id);
        return {
          ...c,
          itens_cotacao_fornecedor: matchingItens,
          cotacao_fornecedor_sessoes: matchingSessoes,
        };
      });
    }
  }

  console.log(`\nCotações combinadas carregadas do banco: ${data.length}`);
  if (data.length > 0) {
    console.log('Primeiro registro:');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

testRobustList();
