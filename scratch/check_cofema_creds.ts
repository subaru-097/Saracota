import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function main() {
  const { data, error } = await supabase
    .from('fornecedores')
    .select('*')
    .ilike('nome', '%cofema%');

  console.log('Error:', error);
  if (data && data.length > 0) {
    console.log(JSON.stringify(data[0], null, 2));
    if (data[0].senha_criptografada) {
      try {
        console.log('Decrypted pass:', decryptAES256(data[0].senha_criptografada));
      } catch (e: any) {
        console.log('Decrypt error:', e.message);
      }
    }
  }
}

main().catch(console.error);
