const supabase = require('../config/supabase');

async function findFields() {
  // Insert empty object to see default columns or schema error with column names
  const { data: cData, error: cErr } = await supabase.from('cotacoes').insert({}).select();
  console.log('Insert empty cotacoes result:', cData, cErr);

  const { data: iData, error: iErr } = await supabase.from('itens_cotacao').insert({}).select();
  console.log('Insert empty itens_cotacao result:', iData, iErr);

  const { data: csData, error: csErr } = await supabase.from('cotacao_fornecedor_sessoes').insert({}).select();
  console.log('Insert empty cotacao_fornecedor_sessoes result:', csData, csErr);
}

findFields();
