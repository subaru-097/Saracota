const { db } = require('./lib/db/client');
const { decryptAES256 } = require('./lib/security/vault');

(async () => {
  console.log('--- INSPEÇÃO DE CREDENCIAIS CICALFER NO BANCO DE DADOS ---');
  try {
    const fornecedores = await db.fornecedores.list();
    console.log(`Total de fornecedores listados: ${fornecedores.length}`);

    const cicalfer = fornecedores.find(f => 
      f.id === '33e03495-100d-45a3-9e34-899de56b0ab1' || 
      (f.nome && f.nome.toLowerCase().includes('cicalfer'))
    );

    if (cicalfer) {
      console.log('\n--- REGISTRO CICALFER ENCONTRADO ---');
      console.log(JSON.stringify(cicalfer, null, 2));

      let email = cicalfer.login_salvo || cicalfer.loginSalvo || cicalfer.email || cicalfer.login || cicalfer.usuario || cicalfer.email_login || cicalfer.login_usuario || cicalfer.emailLogin;
      let rawSenha = cicalfer.senha_login || cicalfer.senha_salva || cicalfer.senhaSalva || cicalfer.senha || cicalfer.senha_criptografada || cicalfer.senhaCriptografada || cicalfer.rawSenhaCriptografada;
      let decSenha = '';
      if (rawSenha) {
        try { decSenha = decryptAES256(rawSenha); } catch(e) { decSenha = rawSenha; }
      }
      console.log(`\nEmail extraído: "${email}"`);
      console.log(`Senha bruta extraída: "${rawSenha}"`);
      console.log(`Senha decriptografada: "${decSenha}"`);
    } else {
      console.log('\nCicalfer não encontrada diretamente pelo ID/Nome!');
    }
  } catch (err) {
    console.error('Erro ao consultar banco:', err);
  }
})();
