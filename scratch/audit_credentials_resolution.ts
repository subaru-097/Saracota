import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

(async () => {
  console.log('=== AUDITORIA DE RESOLUÇÃO DE CREDENCIAIS DE FORNECEDORES ===\n');

  const fornecedores = await db.fornecedores.list();
  console.log(`Total de fornecedores retornados por db.fornecedores.list(): ${fornecedores.length}\n`);

  for (const f of fornecedores) {
    console.log(`--------------------------------------------------`);
    console.log(`Fornecedor ID: ${f.id}`);
    console.log(`Nome: "${f.nome}"`);
    console.log(`rpa_ativo: ${f.rpa_ativo} | rpaAtivo: ${f.rpaAtivo}`);
    console.log(`urlPortalB2B: "${f.urlPortalB2B}"`);
    console.log(`email: "${f.email}"`);
    console.log(`emailLogin: "${f.emailLogin}"`);
    console.log(`login: "${f.login}"`);
    console.log(`senhaLogin: "${f.senhaLogin}"`);
    console.log(`senhaCriptografada: "${f.senhaCriptografada}"`);
    console.log(`rawSenhaCriptografada: "${f.rawSenhaCriptografada}"`);

    const rawPass = (
      f.rawSenhaCriptografada || 
      f.senhaLogin || 
      (f.senhaCriptografada !== '••••••••' ? f.senhaCriptografada : '') || 
      ''
    ).trim();

    let decPass = '';
    if (rawPass) {
      decPass = decryptAES256(rawPass);
    }

    console.log(`Senha resolvida pela vault: "${decPass}" (Length: ${decPass ? decPass.length : 0})`);
  }
})();
