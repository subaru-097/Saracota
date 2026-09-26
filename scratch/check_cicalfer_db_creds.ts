import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function run() {
  const forn = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  console.log('Fornecedor:', forn);
  if (forn?.rawSenhaCriptografada) {
    console.log('Decrypted pass:', decryptAES256(forn.rawSenhaCriptografada));
  }
}

run().catch(console.error);
