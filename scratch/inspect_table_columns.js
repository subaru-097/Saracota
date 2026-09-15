const supabase = require('../config/supabase');

async function inspectColumns() {
  // Let's try inserting an empty object or invalid column to see Supabase's error message which lists allowed columns, or try basic fields
  console.log('--- TRYING SELECT ALL FIELDS ---');
  
  // Try inserting with id only or empty object
  const try1 = await supabase.from('cotacoes').insert([{}]).select();
  console.log('cotacoes insert empty:', JSON.stringify(try1, null, 2));

  const try2 = await supabase.from('logs_automacao').insert([{}]).select();
  console.log('logs_automacao insert empty:', JSON.stringify(try2, null, 2));

  const try3 = await supabase.from('fornecedores').select('*').limit(1);
  console.log('fornecedores:', JSON.stringify(try3, null, 2));
}

inspectColumns();
