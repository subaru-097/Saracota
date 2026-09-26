import 'dotenv/config';
import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function main() {
  const fornecedores = await db.fornecedores.list();
  console.log('=== FORNECEDORES ENCONTRADOS ===');
  for (const f of fornecedores) {
    console.log(`- ID: ${f.id}`);
    console.log(`  Nome: ${f.nome}`);
    console.log(`  ConfigSlug: ${f.configSlug}`);
    console.log(`  Login/Email: ${f.emailLogin || f.login || f.email}`);
    if (f.rawSenhaCriptografada) {
      try {
        console.log(`  Senha Criptografada Raw: ${f.rawSenhaCriptografada}`);
        console.log(`  Senha Decriptografada: ${decryptAES256(f.rawSenhaCriptografada)}`);
      } catch (e: any) {
        console.log(`  Erro ao decriptografar: ${e.message}`);
      }
    } else {
      console.log(`  Sem rawSenhaCriptografada`);
    }
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
