require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { Browserbase } = require('@browserbasehq/sdk');

async function listarSessoesConta() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const bb = new Browserbase({ apiKey });

  console.log('📡 Listando as sessões existentes na conta Browserbase real...');
  const sessions = await bb.sessions.list();
  console.log(`📋 Total de sessões na conta: ${sessions.length}`);
  sessions.slice(0, 10).forEach((s, idx) => {
    console.log(`  [${idx + 1}] ID: ${s.id} | Status: ${s.status} | Criada em: ${s.createdAt}`);
  });
}

listarSessoesConta().catch(console.error);
