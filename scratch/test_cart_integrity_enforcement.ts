import { processarCotacaoFornecedor } from '../lib/services/automacao/matchingEngine';

async function main() {
  console.log("=== TESTE DE INTEGRACAO: COFEMA - VERIFICACAO E INTEGRIDADE DE CARRINHO ===");

  const cotacaoId = 'test-cart-integrity-' + Date.now();
  const cofemaFornecedorId = '752e18bd-4f41-414a-8f66-0d8f538de99e';
  
  // Registrar a cotação no store em memória usado pelo DAL db.cotacoes.getById
  if (!(globalThis as any).__saracota_quotes_store) {
    (globalThis as any).__saracota_quotes_store = {};
  }
  
  (globalThis as any).__saracota_quotes_store[cotacaoId] = {
    id: cotacaoId,
    status: 'em_analise',
    itens: [
      {
        id: 'item-lorenzetti-bella-220v',
        material: 'DUCHA LORENZETTI BELLA DUCHA 6800W 4T 220V BRANCA',
        nomeOriginal: 'DUCHA LORENZETTI BELLA DUCHA 6800W 4T 220V BRANCA',
        quantidade: 5,
        skuFornecedor: '300500',
        sku: '300500'
      }
    ]
  };

  try {
    const resultado = await processarCotacaoFornecedor(cotacaoId, cofemaFornecedorId);
    console.log("\n================ RESULTADO FINAL DO TESTE ================");
    console.log(JSON.stringify(resultado, null, 2));
    if (resultado.sucesso) {
      console.log("✅ Cotação executada com sucesso! Total:", resultado.totalGeral);
    } else {
      console.log("❌ Cotação abortada/com falha como esperado ou devido a erro de integridade:", resultado.mensagem);
    }
  } catch (err) {
    console.error("❌ Exceção no teste:", err);
  }
}

main();
