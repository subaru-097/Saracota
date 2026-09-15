import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const { db } = require('../lib/db/client');

async function runVerification() {
  console.log('=== TESTE DE PERSISTÊNCIA NO BANCO DE DADOS (HISTÓRICO) ===');

  const userId = '61ab64e4-c2cb-46df-bb14-6cc326293085';
  const testPayload = {
    user_id: userId,
    obra_nome: 'Reserva das Palmeiras (Teste E2E)',
    fornecedor: 'Cicalfer Material Elétrico',
    itens: [
      { nome: 'Caixa D\'Água Fortlev 310L', ref: '1234', qtd: 5, precoUnitario: 438.03, precoTotal: 2190.15, unidade: 'un' },
      { nome: 'Ducha Lorenzetti Maxi Ducha', ref: '11137', qtd: 5, precoUnitario: 83.44, precoTotal: 417.20, unidade: 'un' },
    ],
    valor_total: 2607.35,
    quantidade_itens: 2,
  };

  console.log('1. Salvando cotação de teste no banco Supabase / DAL...');
  const savedRecord = await db.historico.salvar(testPayload);
  console.log('-> Cotação salva com ID:', savedRecord.id);
  console.log('-> Vínculo user_id:', savedRecord.user_id);
  console.log('-> Obra:', savedRecord.obra_nome);
  console.log('-> Fornecedor:', savedRecord.fornecedor);
  console.log('-> Expira em (7 dias):', savedRecord.expira_em);

  console.log('\n2. Listando cotações no banco do usuário logado...');
  const historyList = await db.historico.listar(userId);
  console.log(`-> ${historyList.length} registro(s) retornado(s) do histórico.`);
  
  const targetRecord = historyList.find((h: any) => h.id === savedRecord.id);
  if (!targetRecord) {
    throw new Error('ERRO: O registro recém-salvo não foi encontrado na listagem do histórico!');
  }
  console.log('-> Registro verificado:', {
    id: targetRecord.id,
    obra: targetRecord.obra_nome,
    fornecedor: targetRecord.fornecedor,
    valor_total: targetRecord.valor_total,
    qtd_itens: targetRecord.quantidade_itens,
  });

  console.log('\n3. Testando exclusão manual pelo ID...');
  const deletedOk = await db.historico.excluir(savedRecord.id, userId);
  console.log('-> Resultado exclusão:', deletedOk);

  const afterDeleteList = await db.historico.listar(userId);
  const stillExists = afterDeleteList.some((h: any) => h.id === savedRecord.id);
  console.log('-> Registro ainda existe no banco?:', stillExists ? 'SIM (ERRO)' : 'NÃO (SUCESSO)');

  if (stillExists) {
    throw new Error('ERRO: Registro não foi removido do banco!');
  }

  // Recriar um registro oficial para visualização na UI durante o teste do navegador
  console.log('\n4. Criando registro oficial para demonstração visual na UI...');
  const officialRecord = await db.historico.salvar(testPayload);
  console.log('-> Registro para UI gerado com sucesso ID:', officialRecord.id);

  console.log('\n=== TODOS OS TESTES NO BANCO DE DADOS PASSARAM COM SUCESSO ===');
}

runVerification().catch((err) => {
  console.error('FALHA NO TESTE:', err);
  process.exit(1);
});
