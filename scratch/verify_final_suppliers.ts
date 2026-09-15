import { db } from '../lib/db/client';

async function verify() {
  const lista = await db.fornecedores.list();
  console.log('=== VERIFICAÇÃO FINAL DA LISTA DE FORNECEDORES ===\n');

  const checkForn = (id: string, name: string) => {
    const f = lista.find(item => item.id === id || item.nome.toLowerCase() === name.toLowerCase());
    if (!f) {
      console.log(`❌ Fornecedor ${name} (${id}): NÃO ENCONTRADO NO BANCO (Excluído com sucesso).`);
      return;
    }
    const isRpaAtivo = f.rpa_ativo === true || f.rpaAtivo === true || (f.seletores && f.seletores.rpa_ativo === true);
    const hasConfigSlug = Boolean(f.config_slug || f.configSlug || (f.seletores && f.seletores.config_slug));
    const hasSeletores = Boolean(f.seletores && (f.seletores.login || f.seletores.carrinho || f.seletores.campo_email));
    const temAutomacaoRpa = isRpaAtivo && (hasConfigSlug || hasSeletores);

    console.log(`📌 Fornecedor: "${f.nome}" (ID: ${f.id})`);
    console.log(`   - Status RPA: ${temAutomacaoRpa ? '✅ RPA Autônomo Ativo' : '🛠️ Automação em desenvolvimento'}`);
    console.log(`   - Config Slug: "${f.config_slug || f.configSlug || 'N/A'}"`);
    console.log(`   - Possui seletores no banco?: ${hasSeletores ? 'Sim' : 'Não'}\n`);
  };

  checkForn('a1684c4d-d896-4ba9-a591-cda455c5ffe2', 'Construjá');
  checkForn('33e03495-100d-45a3-9e34-899de56b0ab1', 'Cicalfer');
  checkForn('0e75b26e-6ff7-4fb0-a783-897ca1224f48', 'Megaleste');
  checkForn('5f884210-9e12-4c22-921a-8c5e9b7722bb', 'Secofair');
}

verify();
