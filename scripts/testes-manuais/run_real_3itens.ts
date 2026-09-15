// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

import { db } from '../lib/db/client';
import { processarCotacaoTodosFornecedores } from '../lib/services/automacao/matchingEngine';

(async () => {
  console.log('=== EXECUÇÃO DA COTAÇÃO DOS 3 ITENS VIA SARACOTA MATCHING ENGINE ===');

  // 1. Criar cotação no banco com os 3 itens solicitados (somente pela descrição)
  const cotacao = await db.cotacoes.create({
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    fornecedorIds: ['33e03495-100d-45a3-9e34-899de56b0ab1'],
    status: 'pendente',
    origem: 'texto',
    itens: [
      { cotacao_id: '', material: '2 uni CABO FLEX 100M COBRECOM 2,50MM', quantidade: 2, unidade: 'UN', preco_unitario: 0 },
      { cotacao_id: '', material: '5 uni DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 5, unidade: 'UN', preco_unitario: 0 },
      { cotacao_id: '', material: '7 uni DUCHA LORENZETTI TOP JET MULTI 127V', quantidade: 7, unidade: 'UN', preco_unitario: 0 }
    ]
  });

  console.log(`Cotação criada com sucesso: ID "${cotacao.id}"`);

  // 2. Executar o processamento autônomo do robô Cicalfer
  await processarCotacaoTodosFornecedores(cotacao.id);

  console.log('\nProcessamento dos 3 itens finalizado! Verificando resultados salvos no banco...');
  const resultados = await db.cotacoes.obterResultadosMatching(cotacao.id);
  console.log(JSON.stringify(resultados, null, 2));
})();
