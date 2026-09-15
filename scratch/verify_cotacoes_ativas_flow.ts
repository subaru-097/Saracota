import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const { db } = require('../lib/db/client');

async function runActiveQuotesTest() {
  console.log('===============================================================');
  console.log('=== TESTE DE PERSISTÊNCIA E UPSERT DE COTAÇÕES ATIVAS (DAL) ===');
  console.log('===============================================================\n');

  const userId = '61ab64e4-c2cb-46df-bb14-6cc326293085';
  const obraId = 'Reserva das Palmeiras';

  const fornCicalferId = '33e03495-100d-45a3-9e34-899de56b0ab1'; // ID estável Cicalfer
  const fornConstrujarId = '99f03495-88d-45a3-9e34-899de56b0ab9'; // ID estável Construjar

  // 1. Estado inicial da tabela cotacoes_ativas
  console.log('1. Consultando estado inicial de cotacoes_ativas no banco...');
  let listInicial = await db.cotacoesAtivas.listar(userId, obraId);
  console.log(`-> Registros iniciais encontrados: ${listInicial.length}`);
  console.log('Conteúdo cotacoes_ativas [INICIAL]:', JSON.stringify(listInicial, null, 2));

  // 2. Cotar com Cicalfer (Rodada 1)
  console.log('\n2. Executando Cotação Rodada 1: Apenas Cicalfer Material Elétrico...');
  const cicalferRodada1 = await db.cotacoesAtivas.upsert({
    user_id: userId,
    obra_id: obraId,
    fornecedor_id: fornCicalferId,
    fornecedor_nome: 'Cicalfer Material Elétrico',
    itens: [
      { nome: 'Caixa D\'Água Fortlev 310L', ref: '1234', qtd: 5, precoUnitario: 438.03, precoTotal: 2190.15 },
    ],
    valor_total: 2190.15,
  });
  console.log('-> Cicalfer (Rodada 1) salvo com ID:', cicalferRodada1.id);

  let listPosRodada1 = await db.cotacoesAtivas.listar(userId, obraId);
  console.log(`-> Conteúdo cotacoes_ativas [APÓS RODADA 1 - Cicalfer] (${listPosRodada1.length} cards):`);
  console.log(JSON.stringify(listPosRodada1.map(c => ({ id: c.id, forn: c.fornecedor_nome, total: c.valor_total, itensCount: c.itens.length })), null, 2));

  if (listPosRodada1.length !== 1 || listPosRodada1[0].fornecedor_nome !== 'Cicalfer Material Elétrico') {
    throw new Error('ERRO: Card da Cicalfer não foi salvo corretamente na Rodada 1!');
  }

  // 3. Cotar novamente com Cicalfer (com valores novos) + Fornecedor NOVO (Construjar) (Rodada 2)
  console.log('\n3. Executando Cotação Rodada 2: Cicalfer (Atualização/Sobrescrita) + Construjar (Novo Card)...');
  
  // Cicalfer com novos itens e novos preços (sobrescrita por user_id + obra_id + fornecedor_id)
  const cicalferRodada2 = await db.cotacoesAtivas.upsert({
    user_id: userId,
    obra_id: obraId,
    fornecedor_id: fornCicalferId,
    fornecedor_nome: 'Cicalfer Material Elétrico',
    itens: [
      { nome: 'Caixa D\'Água Fortlev 310L', ref: '1234', qtd: 5, precoUnitario: 438.03, precoTotal: 2190.15 },
      { nome: 'Ducha Lorenzetti Maxi Ducha', ref: '11137', qtd: 5, precoUnitario: 83.44, precoTotal: 417.20 },
    ],
    valor_total: 2607.35,
  });

  // Construjar (novo fornecedor)
  const construjarRodada2 = await db.cotacoesAtivas.upsert({
    user_id: userId,
    obra_id: obraId,
    fornecedor_id: fornConstrujarId,
    fornecedor_nome: 'Construjar Materiais',
    itens: [
      { nome: 'Cimento CP-II Itaú 50kg', ref: '9001', qtd: 20, precoUnitario: 34.50, precoTotal: 690.00 },
    ],
    valor_total: 690.00,
  });

  console.log('-> Cicalfer (Rodada 2 - Sobrescrito) ID:', cicalferRodada2.id);
  console.log('-> Construjar (Rodada 2 - Adicionado) ID:', construjarRodada2.id);

  let listPosRodada2 = await db.cotacoesAtivas.listar(userId, obraId);
  console.log(`\n-> Conteúdo cotacoes_ativas [APÓS RODADA 2 - Cicalfer Atualizada + Construjar Nova] (${listPosRodada2.length} cards):`);
  console.log(JSON.stringify(listPosRodada2.map(c => ({ id: c.id, forn: c.fornecedor_nome, total: c.valor_total, itensCount: c.itens.length })), null, 2));

  // Validação estrita do teste
  const cicalferCard = listPosRodada2.find(c => c.fornecedor_id === fornCicalferId);
  const construjarCard = listPosRodada2.find(c => c.fornecedor_id === fornConstrujarId);

  if (!cicalferCard || !construjarCard) {
    throw new Error('ERRO: Cards esperados (Cicalfer e Construjar) não encontrados no banco!');
  }

  if (cicalferCard.valor_total !== 2607.35 || cicalferCard.itens.length !== 2) {
    throw new Error(`ERRO: Card da Cicalfer não foi atualizado! Valor obtido: ${cicalferCard.valor_total}`);
  }

  if (construjarCard.valor_total !== 690.00 || construjarCard.itens.length !== 1) {
    throw new Error('ERRO: Card da Construjar não foi adicionado corretamente!');
  }

  // Verificar que não houve duplicação de Cicalfer
  const countCicalfer = listPosRodada2.filter(c => c.fornecedor_id === fornCicalferId).length;
  console.log(`\n-> Ocorrências da Cicalfer no banco após re-cotação: ${countCicalfer} (Esperado: 1)`);
  if (countCicalfer !== 1) {
    throw new Error('ERRO: Havia mais de um card para o mesmo fornecedor (duplicação detectada)!');
  }

  console.log('\n===============================================================');
  console.log('=== TODOS OS TESTES DE BANCO E UPSERT PASSARAM COM SUCESSO! ===');
  console.log('===============================================================');
}

runActiveQuotesTest().catch((err) => {
  console.error('FALHA NO TESTE:', err);
  process.exit(1);
});
