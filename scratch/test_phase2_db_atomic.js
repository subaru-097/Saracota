const { db, supabase } = require('../lib/db/client');
const crypto = require('crypto');

async function testPhase2AtomicDb() {
  console.log(`================================================================`);
  console.log(`🚀 TESTE DA FASE 2: VALIDAÇÃO DE ESCRITA ATÔMICA E SCHEMA FIX`);
  console.log(`================================================================\n`);

  const cotacaoId = crypto.randomUUID();
  const fornecedorId = '33e03495-100d-45a3-9e34-899de56b0ab1';

  console.log(`1. Criando Cotação com UUID real: ${cotacaoId}...`);
  const cotacaoCriada = await db.cotacoes.create({
    id: cotacaoId,
    valor_total: 1479.04,
    status: 'pendente',
    obraNome: 'Obra Teste Fase 2',
    itens: [
      { material: 'CABO FLEX 100M COBRECOM 2,50MM AM', quantidade: 5, preco_unitario: 235.16 },
      { material: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM', quantidade: 12, preco_unitario: 4.71 }
    ]
  });
  console.log(`   └─ Cotação salva no DB com ID: ${cotacaoCriada.id} | Valor Total: ${cotacaoCriada.valorTotalGeral}\n`);

  const resultadosMock = [
    {
      itemPedido: 'CABO FLEX 100M COBRECOM 2,50MM AM',
      produtoEncontrado: 'CABO FLEX 100M COBRECOM 2,50MM AM REF: 10672',
      preco: 235.16,
      quantidade: 5,
      status: 'CONFIRMADO',
      confianca: 95
    },
    {
      itemPedido: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM',
      produtoEncontrado: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM REF: 11992',
      preco: 4.71,
      quantidade: 12,
      status: 'CONFIRMADO',
      confianca: 95
    }
  ];

  console.log(`2. Executando 1ª gravação de resultados (salvarResultadosMatching)...`);
  await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, resultadosMock);

  console.log(`3. Executando 2ª gravação (SIMULAÇÃO DE RETRY / RE-EXECUÇÃO CONCORRENTE)...`);
  await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, resultadosMock);

  console.log(`\n4. Verificando o estado via db.cotacoes.obterResultadosMatching("${cotacaoId}")...`);
  const matchingItens = await db.cotacoes.obterResultadosMatching(cotacaoId);
  console.log(`   └─ Total de itens retornados pela API DAL: ${matchingItens.length} (Esperado: exatamente 2)`);
  matchingItens.forEach((it, idx) => {
    console.log(`      └─ Item ${idx + 1}: "${it.itemPedido || it.produtoEncontrado}" | Preço: R$ ${it.preco} | Qtd: ${it.quantidade}`);
  });

  if (matchingItens.length === 2) {
    console.log(`\n================================================================`);
    console.log(`✅ FASE 2 VALIDADA COM SUCESSO! SEM DUPLICATAS (0 duplicadas em 2 execuções).`);
    console.log(`================================================================`);
  } else {
    console.warn(`\n⚠️ Atenção: Número de linhas diferente do esperado: ${matchingItens.length}`);
  }
}

testPhase2AtomicDb().catch(err => {
  console.error("Erro fatal no teste da Fase 2:", err);
  process.exit(1);
});
