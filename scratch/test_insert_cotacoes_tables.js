const supabase = require('../config/supabase');

async function testInsert() {
  console.log('--- Insert cotacoes_carrinho ---');
  const { data: cc, error: errCC } = await supabase.from('cotacoes_carrinho').insert({}).select();
  console.log('cotacoes_carrinho err:', errCC);

  console.log('--- Insert cotacoes ---');
  const { data: c, error: errC } = await supabase.from('cotacoes').insert({}).select();
  console.log('cotacoes err:', errC);

  console.log('--- Insert logs_automacao ---');
  const { data: l, error: errL } = await supabase.from('logs_automacao').insert({}).select();
  console.log('logs_automacao err:', errL);
}

testInsert();
