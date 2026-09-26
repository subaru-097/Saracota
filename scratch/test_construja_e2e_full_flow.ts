import { processarCotacaoFornecedor } from '../lib/services/automacao/matchingEngine';
import { db } from '../lib/db/client';

async function main() {
  console.log('🚀 [EXECUÇÃO E2E CONSTRUJÁ - VALIDAÇÃO COMPLETA DE COTAÇÃO REAL]');

  // 1. Criar cotação de teste com os 2 itens da Construjá
  const cotacao = await db.cotacoes.create({
    titulo: 'Cotação Validação Construjá',
    status: 'pendente',
    itens: [
      { material: '3 FORTLEV - CX DAGUA C/TAMPA 1000L', quantidade: 3 },
      { material: '12 VEDALIT 900ML', quantidade: 12 }
    ]
  });

  console.log(`Cotação criada no banco ID: "${cotacao.id}"`);

  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';

  // 2. Executar processarCotacaoFornecedor
  const result = await processarCotacaoFornecedor(cotacao.id, construjaId, async (msg) => {
    console.log(`  [PROGRESSO RPA]: ${msg}`);
  });

  console.log('\n=== RESULTADO COMPLETO DA COTAÇÃO CONSTRUJÁ ===');
  console.log(JSON.stringify(result, null, 2));

  // 3. Consultar no banco os itens salvos para confirmar persistência de preço e status
  const cotacaoFinal = await db.cotacoes.getById(cotacao.id);
  console.log('\n=== ITENS GRAVADOS NO BANCO SARAKOTA ===');
  console.log(JSON.stringify(cotacaoFinal?.itens_cotacao_fornecedor, null, 2));

  if (result.sucesso && result.itensProcessados.every(i => i.status === 'CONFIRMADO' && i.preco > 0)) {
    console.log('\n✅ VALIDAÇÃO SUCESSO 100%! Preços unitários e totais capturados corretamente!');
  } else {
    console.error('\n❌ Falha no teste E2E Construjá');
  }
}

main().catch(console.error);
