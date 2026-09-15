import { processarCotacaoTodosFornecedores } from '../lib/services/automacao/matchingEngine';
import { db } from '../lib/db/client';

(async () => {
  console.log('=== TESTE DE VALIDAÇÃO: DEDUPLICAÇÃO E MATCHING 1-PARA-1 (9 ITENS CICALFER) ===');

  // Lista dos 9 itens para a cotação
  const itens = [
    { material: "CAIXA DE ÁGUA FECHADA FORTLEV 310 LITROS", quantidade: 5, unidade: 'un' },
    { material: "DUCHA LORENZETTI MAXI DUCHA 127V", quantidade: 7, unidade: 'un' },
    { material: "DUCHA LORENZETTI BELLA DUCHA 127V", quantidade: 6, unidade: 'un' },
    { material: "BIANCO 900G", quantidade: 10, unidade: 'un' },
    { material: "ALICATE BOMBA D'ÁGUA MTX 10", quantidade: 12, unidade: 'un' },
    { material: "ALICATE PRESSÃO CURVO MTX 10", quantidade: 2, unidade: 'un' },
    { material: "BROCA CHATA MADEIRA IRWIN", quantidade: 4, unidade: 'un' },
    { material: "APLICADOR SILICONE SPARTA", quantidade: 3, unidade: 'un' },
    { material: "CONDUÍTE CORR AM FORTLEV", quantidade: 5, unidade: 'un' }
  ];

  // 1. Criar cotação no Supabase com os 9 itens
  const cot = await db.cotacoes.create({
    obraNome: 'Reserva das Palmeiras',
    status: 'pendente',
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    fornecedorIds: ['33e03495-100d-45a3-9e34-899de56b0ab1'],
    itens
  });

  console.log(`[TESTE] Cotação criada/upserted no Supabase com ID: "${cot.id}"`);

  // 2. Disparar processarCotacaoTodosFornecedores
  console.log('[TESTE] Disparando automação RPA e extração de carrinho em background...');
  
  const res = await processarCotacaoTodosFornecedores(cot.id, async (msg) => {
    console.log(` > ${msg}`);
  });

  console.log('\n=======================================================');
  console.log('RESULTADO DO MATCHING FINAL (JSON DO ARRAY DE 9 ITENS):');
  console.log('=======================================================');
  
  const matchingResults = await db.cotacoes.obterResultadosMatching(cot.id);
  console.log(JSON.stringify(matchingResults, null, 2));

  // 3. Validação de desduplicação
  const produtosEncontrados = matchingResults.map(r => r.produtoEncontrado).filter(Boolean);
  const unicos = new Set(produtosEncontrados);

  console.log('\n--- ESTATÍSTICAS DE VERIFICAÇÃO ---');
  console.log(`Total de itens no relatório: ${matchingResults.length}`);
  console.log(`Total de produtos únicos encontrados: ${unicos.size}`);

  if (matchingResults.length === unicos.size) {
    console.log('✅ TESTE APROVADO! Todos os itens do relatório são ÚNICOS e SEM DUPLICAÇÃO!');
  } else {
    console.warn('⚠️ ALERTA DE DUPLICAÇÃO: Houve produtos duplicados no relatório final!');
    const duplicados = produtosEncontrados.filter((item, index) => produtosEncontrados.indexOf(item) !== index);
    console.warn('Itens duplicados:', duplicados);
  }
})();
