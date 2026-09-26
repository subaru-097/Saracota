import { supabase } from '../lib/db/client';

async function checkSuppliers() {
  const { data: suppliers } = await supabase.from('fornecedores').select('*');
  console.log('--- LISTA DE FORNECEDORES NO SUPABASE ---');
  suppliers?.forEach((f: any) => {
    console.log(`ID: ${f.id} | Nome: ${f.nome}`);
    console.log(`  rpa_ativo (coluna DB):`, f.rpa_ativo);
    console.log(`  seletores.rpa_ativo:`, f.seletores?.rpa_ativo);
    console.log(`  seletores.slug / config_slug:`, f.seletores?.slug, f.seletores?.config_slug, f.config_slug);
  });
}

checkSuppliers().catch(console.error);
