const supabase = require('../config/supabase');

async function inspectAll() {
  console.log('--- Table: cotacoes ---');
  const { data: cData, error: cErr } = await supabase.from('cotacoes').select('*').limit(1);
  console.log('cotacoes:', cData, cErr);

  console.log('--- Table: cotacoes_carrinho ---');
  const { data: ccData, error: ccErr } = await supabase.from('cotacoes_carrinho').select('*').limit(1);
  console.log('cotacoes_carrinho:', ccData, ccErr);

  console.log('--- Table: cotacao_fornecedor_sessoes ---');
  const { data: cfsData, error: cfsErr } = await supabase.from('cotacao_fornecedor_sessoes').select('*').limit(1);
  console.log('cotacao_fornecedor_sessoes:', cfsData, cfsErr);

  console.log('--- Table: logs_automacao ---');
  const { data: logData, error: logErr } = await supabase.from('logs_automacao').select('*').limit(1);
  console.log('logs_automacao:', logData, logErr);

  console.log('--- Table: fornecedores ---');
  const { data: fData, error: fErr } = await supabase.from('fornecedores').select('*').limit(1);
  console.log('fornecedores:', fData, fErr);
}

inspectAll();
