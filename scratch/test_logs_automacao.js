const supabase = require('../config/supabase');

async function testLogsAutomacao() {
  console.log('Testing logs_automacao...');

  // Try different potential column names for logs_automacao
  const t1 = await supabase.from('logs_automacao').insert([{ status: 'sucesso' }]).select();
  console.log('insert {status}:', t1);

  const t2 = await supabase.from('logs_automacao').insert([{ mensagem: 'Teste cotação Cicalfer' }]).select();
  console.log('insert {mensagem}:', t2);

  const t3 = await supabase.from('logs_automacao').insert([{ tipo: 'RPA_QUOTE', conteudo: 'Cotação realizada' }]).select();
  console.log('insert {tipo, conteudo}:', t3);
}

testLogsAutomacao();
