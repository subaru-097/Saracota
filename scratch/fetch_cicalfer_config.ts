import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function fetchCicalferConfig() {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('fornecedores')
    .select('*');

  console.log('Fornecedores list:', data?.map(f => ({ id: f.id, nome: f.nome, email: f.email_login, passEnc: f.raw_senha_criptografada ? 'Sim' : 'Não' })));

  const cicalfer = data?.find(f => f.nome.toLowerCase().includes('cicalfer'));
  if (cicalfer) {
    console.log('\n--- CICALFER DETALHES ---');
    console.log('ID:', cicalfer.id);
    console.log('Email/Login:', cicalfer.email_login);
    if (cicalfer.raw_senha_criptografada) {
      try {
        console.log('Senha:', decryptAES256(cicalfer.raw_senha_criptografada));
      } catch (e: any) {
        console.log('Erro decrypt:', e.message);
      }
    }
  }
}

fetchCicalferConfig();
