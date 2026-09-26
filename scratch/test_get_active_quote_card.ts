import { db } from '../lib/db/client';

async function testGetActiveCards() {
  console.log('🔍 Listing cotacoesAtivas for usr-admin-1...');
  const list = await db.cotacoesAtivas.listar('usr-admin-1', 'Reserva das Palmeiras');
  console.log('Active Cards Count:', list.length);
  console.log('Active Cards:', JSON.stringify(list, null, 2));
}

testGetActiveCards().catch(console.error);
