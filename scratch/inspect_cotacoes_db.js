const { supabase } = require('../lib/db/client');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function inspectCotacoes() {
  console.log('=== INSPEÇÃO COMPLETA DA TABELA COTACOES NO SUPABASE ===');

  const { data: cotacoes, error } = await supabase
    .from('cotacoes')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('Erro ao consultar cotacoes:', error);
    process.exit(1);
  }

  console.log(`Total de cotações encontradas na tabela: ${cotacoes ? cotacoes.length : 0}`);
  console.log('\n--- LISTA BRUTA DE REGISTROS NA TABELA COTACOES ---');
  console.log(JSON.stringify(cotacoes, null, 2));

  // Agrupamento por Obra, Fornecedor e Status
  const agrupado = {};
  (cotacoes || []).forEach(c => {
    const key = `Obra: ${c.obra_nome || c.obra || 'Sem Obra'} | Fornecedor: ${c.fornecedor_id || (c.fornecedores_selecionados ? c.fornecedores_selecionados[0] : 'Sem Fornecedor')} | Status: ${c.status}`;
    if (!agrupado[key]) {
      agrupado[key] = { count: 0, ids: [], valores: [] };
    }
    agrupado[key].count++;
    agrupado[key].ids.push(c.id);
    agrupado[key].valores.push(c.valor_total);
  });

  console.log('\n--- AGRUPAMENTO POR OBRA + FORNECEDOR + STATUS ---');
  console.log(JSON.stringify(agrupado, null, 2));
}

inspectCotacoes().catch(err => {
  console.error('Erro na inspeção:', err);
  process.exit(1);
});
