const { processarCotacaoFornecedor } = require('../lib/services/automacao/matchingEngine');
const { db } = require('../lib/db/client');

(async () => {
  console.log('================================================================');
  console.log('🧪 [TESTE 16] AUDITORIA E VERIFICAÇÃO DE COTAÇÃO CICALFER & CONSTRUJÁ');
  console.log('================================================================');

  const cotacaoId = `test16-${Date.now()}`;
  const itens = [
    { material: '3 CAIXA DA AGUA FORTLEV 310L', quantidade: 3 },
    { material: '6 DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 6 }
  ];

  const cicalferId = '33e03495-100d-45a3-9e34-899de56b0ab1';
  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';

  const cotData = {
    id: cotacaoId,
    obraNome: 'Reserva das Palmeiras',
    itens,
    fornecedorIds: [cicalferId, construjaId],
    fornecedores_selecionados: [cicalferId, construjaId],
    status: 'processando'
  };

  if (!globalThis.__saracota_quotes_store) globalThis.__saracota_quotes_store = {};
  globalThis.__saracota_quotes_store[cotacaoId] = cotData;

  console.log(`\n--- ETAPA 1: COTAÇÃO SOLO CICALFER (${cicalferId}) ---`);
  const resCicalfer = await processarCotacaoFornecedor(cotacaoId, cicalferId, async (msg) => {
    console.log(`[CICALFER PROGRESS] ${msg}`);
  });

  console.log('\n[RESULTADO CICALFER]:', JSON.stringify(resCicalfer, null, 2));

  console.log(`\n--- ETAPA 2: COTAÇÃO SOLO CONSTRUJÁ (${construjaId}) ---`);
  const resConstruja = await processarCotacaoFornecedor(cotacaoId, construjaId, async (msg) => {
    console.log(`[CONSTRUJA PROGRESS] ${msg}`);
  });

  console.log('\n[RESULTADO CONSTRUJÁ]:', JSON.stringify(resConstruja, null, 2));

  console.log('\n================================================================');
  console.log('🏁 AUDITORIA FINALIZADA');
  console.log('================================================================');
})();
