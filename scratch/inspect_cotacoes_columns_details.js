const supabase = require('../config/supabase');

async function inspectColumns() {
  console.log('--- Testing insert on cotacoes ---');
  const { data: cData, error: cErr } = await supabase.from('cotacoes').insert([{ status: 'pendente', valor_total: 100 }]).select();
  console.log('Result insert cotacoes:', cData, cErr);

  console.log('--- Testing insert on itens_cotacao ---');
  if (cData && cData[0]) {
    const { data: iData, error: iErr } = await supabase.from('itens_cotacao').insert([{ cotacao_id: cData[0].id, material: 'Item Teste', quantidade: 10, preco_unitario: 5 }]).select();
    console.log('Result insert itens_cotacao:', iData, iErr);
  }

  // Check cotacao_fornecedor_sessoes or other tables
  const { data: sData, error: sErr } = await supabase.from('cotacao_fornecedor_sessoes').select('*').limit(1);
  console.log('cotacao_fornecedor_sessoes sample:', sData, sErr);
}

inspectColumns();
