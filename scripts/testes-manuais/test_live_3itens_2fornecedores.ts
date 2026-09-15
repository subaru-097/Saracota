// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

import { db } from '../lib/db/client';
import { processarCotacaoTodosFornecedores } from '../lib/services/automacao/matchingEngine';

(async () => {
  console.log('================================================================');
  console.log('🧪 TESTE DE INTEGRAÇÃO MULTI-FORNECEDOR: 3 ITENS x 2 FORNECEDORES');
  console.log('================================================================\n');

  const forn1_Cicalfer = '33e03495-100d-45a3-9e34-899de56b0ab1';
  const forn2_Secofair = '5f884210-9e12-4c22-921a-8c5e9b7722bb';

  const payloadCotacao = {
    obraNome: 'Obra Comercial Multi-Fornecedor',
    fornecedor_id: forn1_Cicalfer,
    fornecedorIds: [forn1_Cicalfer, forn2_Secofair],
    itens: [
      {
        cotacao_id: '',
        material: 'CABO FLEX 100M COBRECOM 2,50MM AM',
        quantidade: 5,
        unidade: 'm',
        preco_unitario: 0,
        categoria: 'eletrica',
      },
      {
        cotacao_id: '',
        material: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM',
        quantidade: 12,
        unidade: 'un',
        preco_unitario: 0,
        categoria: 'ferramentas',
      },
      {
        cotacao_id: '',
        material: 'Chuveiro Lorenzetti Maxi Ducha',
        quantidade: 2,
        unidade: 'un',
        preco_unitario: 0,
        categoria: 'hidraulica',
      },
    ],
  };

  console.log('1. Criando cotação no sistema com 3 ITENS e 2 FORNECEDORES selecionados...');
  const novaCotacao = await db.cotacoes.create(payloadCotacao);
  console.log(`✅ Cotação criada com sucesso! ID: "${novaCotacao.id}"`);

  console.log('\n2. VERIFICAÇÃO PRE-DISPARO: Lendo cotação salva via db.cotacoes.getById...');
  const cotacaoLida = await db.cotacoes.getById(novaCotacao.id);

  const fornIds = (cotacaoLida as any)?.fornecedorIds || [];
  const itens = cotacaoLida?.itens || [];

  console.log(`📋 Fornecedores Selecionados (${fornIds.length}):`, fornIds);
  console.log(`📋 Total de Itens no Bloco (${itens.length}):`);
  itens.forEach((it: any, idx: number) => {
    console.log(`   └─ Item ${idx + 1}: "${it.material || it.texto}" | Qtd: ${it.quantidade} | Categoria: ${it.categoria}`);
  });

  if (fornIds.length !== 2 || itens.length !== 3) {
    console.error('❌ ERRO NA MONTAGEM DO PAYLOAD! Esperado 2 fornecedores e 3 itens.');
    process.exit(1);
  }

  console.log('\n3. DISPARANDO AUTOMATIZAÇÃO EM LOOP PARA OS 2 FORNECEDORES (matchingEngine.ts)...');
  await processarCotacaoTodosFornecedores(novaCotacao.id);

  console.log('\n4. VERIFICAÇÃO DE RESULTADOS PERSISTIDOS POR FORNECEDOR NO BANCO:');
  const resultadosMatch = await db.cotacoes.obterResultadosMatching(novaCotacao.id);
  console.log(`📊 Total de registros de resultado gerados no banco: ${resultadosMatch.length}`);

  for (const fId of fornIds) {
    const resFornecedor = resultadosMatch.filter((r: any) => r.fornecedorId === fId);
    console.log(`\n  🏬 Fornecedor ID: ${fId}`);
    console.log(`     └─ Total de itens gravados: ${resFornecedor.length}`);
    resFornecedor.forEach((item: any, idx: number) => {
      console.log(`        └─ [${idx + 1}] Item: "${item.itemPedido}" | Status: ${item.status} | Preço: R$ ${item.preco}`);
    });
  }

  console.log('\n================================================================');
  console.log('✅ TESTE DE INTEGRAÇÃO MULTI-FORNECEDOR CONCLUÍDO COM SUCESSO!');
  console.log('================================================================');
})();
