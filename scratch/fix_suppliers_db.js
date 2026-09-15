require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function runDbUpdates() {
  console.log('--- 1. Excluindo Secofair do Supabase ---');
  const { error: delErr } = await supabase.from('fornecedores').delete().eq('id', '5f884210-9e12-4c22-921a-8c5e9b7722bb');
  if (delErr) console.error('Erro ao excluir Secofair:', delErr);
  else console.log('✅ Secofair excluído do Supabase com sucesso.');

  console.log('--- 2. Atualizando Megaleste no Supabase (sem RPA) ---');
  const { error: megaErr } = await supabase.from('fornecedores').update({ seletores: null }).eq('id', '0e75b26e-6ff7-4fb0-a783-897ca1224f48');
  if (megaErr) console.error('Erro ao atualizar Megaleste:', megaErr);
  else console.log('✅ Megaleste atualizado (sem seletores/sem RPA).');

  console.log('--- 3. Atualizando Construjá no Supabase ---');
  const { data: fornConstruja } = await supabase.from('fornecedores').select('seletores').eq('id', 'a1684c4d-d896-4ba9-a591-cda455c5ffe2').single();
  const selConstruja = fornConstruja ? (fornConstruja.seletores || {}) : {};
  selConstruja.rpa_ativo = true;
  selConstruja.config_slug = 'construja';

  const { error: consErr } = await supabase.from('fornecedores').update({
    nome: 'Construjá',
    seletores: selConstruja
  }).eq('id', 'a1684c4d-d896-4ba9-a591-cda455c5ffe2');
  if (consErr) console.error('Erro ao atualizar Construjá:', consErr);
  else console.log('✅ Construjá atualizado (nome = "Construjá", rpa_ativo = true, config_slug = "construja").');

  console.log('--- 4. Atualizando Cicalfer no Supabase ---');
  const { data: fornCicalfer } = await supabase.from('fornecedores').select('seletores').eq('id', '33e03495-100d-45a3-9e34-899de56b0ab1').single();
  const selCicalfer = fornCicalfer ? (fornCicalfer.seletores || {}) : {};
  selCicalfer.rpa_ativo = true;
  selCicalfer.config_slug = 'cicalfer';

  const { error: cicErr } = await supabase.from('fornecedores').update({
    nome: 'Cicalfer',
    seletores: selCicalfer
  }).eq('id', '33e03495-100d-45a3-9e34-899de56b0ab1');
  if (cicErr) console.error('Erro ao atualizar Cicalfer:', cicErr);
  else console.log('✅ Cicalfer atualizado (nome = "Cicalfer", rpa_ativo = true, config_slug = "cicalfer").');
}

runDbUpdates();
