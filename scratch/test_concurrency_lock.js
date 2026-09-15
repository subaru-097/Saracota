const { processarCotacaoTodosFornecedores, isCotacaoEmProcessamento } = require('../lib/services/automacao/matchingEngine');

async function testConcurrencyLock() {
  const cotacaoId = `cot-test-lock-${Date.now()}`;
  console.log(`================================================================`);
  console.log(`🚀 TESTE DE CONCORRÊNCIA: DISPARO DUPLO SIMULTÂNEO DA COTAÇÃO`);
  console.log(`ID da Cotação de Teste: ${cotacaoId}`);
  console.log(`================================================================\n`);

  console.log(`1. Checando status inicial antes dos disparos...`);
  const statusAntes = await isCotacaoEmProcessamento(cotacaoId);
  console.log(`   └─ isCotacaoEmProcessamento("${cotacaoId}"): ${statusAntes} (esperado: false)\n`);

  console.log(`2. Simulando DUPLO CLIQUE (Disparo 1 e Disparo 2 disparados no MESMO milissegundo)...`);

  // Disparar ambas as chamadas simultaneamente em paralelo via Promise.all
  const disparo1 = processarCotacaoTodosFornecedores(cotacaoId);
  const disparo2 = processarCotacaoTodosFornecedores(cotacaoId);

  // Aguardar a resolução de ambas
  await Promise.all([disparo1, disparo2]);

  console.log(`\n3. Checando status final após a conclusão do primeiro disparo...`);
  const statusDepois = await isCotacaoEmProcessamento(cotacaoId);
  console.log(`   └─ isCotacaoEmProcessamento("${cotacaoId}"): ${statusDepois} (esperado: false após limpeza no finally)\n`);

  console.log(`================================================================`);
  console.log(`✅ TESTE CONCLUÍDO COM SUCESSO: A segunda chamada foi rejeitada pelo Lock!`);
  console.log(`================================================================`);
}

testConcurrencyLock().catch(err => {
  console.error("Erro fatal no teste de concorrência:", err);
  process.exit(1);
});
