const supabase = require('../config/supabase');

async function inspectSchema() {
  console.log('--- INSPECTING TABLES ---');
  const { data: cotacoes, error: errC } = await supabase.from('cotacoes').select('*').limit(1);
  console.log('cotacoes sample:', cotacoes, 'err:', errC);

  const { data: logsAuto, error: errL } = await supabase.from('logs_automacao').select('*').limit(1);
  console.log('logs_automacao sample:', logsAuto, 'err:', errL);

  const { data: cotacoesCarrinho, error: errCar } = await supabase.from('cotacoes_carrinho').select('*').limit(1);
  console.log('cotacoes_carrinho sample:', cotacoesCarrinho, 'err:', errCar);
}

inspectSchema();
