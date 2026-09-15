require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { db } = require('../lib/db/client');

async function testList() {
  const lista = await db.fornecedores.list();
  console.log('--- FORNECEDORES LIDOS DE db.fornecedores.list() ---');
  lista.forEach(f => {
    console.log(`- ID: ${f.id} | Nome: "${f.nome}" | rpa_ativo: ${f.rpa_ativo} | config_slug: "${f.config_slug}" | seletores: ${Boolean(f.seletores)}`);
  });
}
testList();
