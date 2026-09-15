// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

const { db } = require('../lib/db/client');
const { decryptAES256 } = require('../lib/security/vault');

(async () => {
  try {
    const forn = await db.fornecedores.list();
    const cicalfer = forn.find(f => f.id === '33e03495-100d-45a3-9e34-899de56b0ab1' || f.nome.toLowerCase().includes('cicalfer'));
    console.log('Cicalfer DB Record:', cicalfer);
    if (cicalfer) {
      console.log('email:', cicalfer.email || cicalfer.emailLogin || cicalfer.login);
      console.log('rawSenha:', cicalfer.rawSenhaCriptografada || cicalfer.senhaLogin);
    }
  } catch(e) {
    console.error(e);
  }
})();
