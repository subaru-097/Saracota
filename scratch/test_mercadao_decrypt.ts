import { supabase } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function testDecryption() {
  const { data: mercadao } = await supabase.from('fornecedores').select('*').eq('id', 'a4042203-b504-4a82-af41-8ffa19ae24a6').single();
  if (mercadao && mercadao.senha_criptografada) {
    const decrypted = decryptAES256(mercadao.senha_criptografada);
    console.log('Login:', mercadao.login_salvo);
    console.log('Decrypted Password length:', decrypted.length);
    console.log('Decrypted Password (first 2 chars + mask):', decrypted.substring(0, 2) + '***');
    return decrypted;
  }
}

testDecryption().catch(console.error);
