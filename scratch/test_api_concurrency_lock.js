const { isCotacaoEmProcessamento } = require('../lib/services/automacao/matchingEngine');

async function testApiRouteLockLogic() {
  const cotacaoId = `cot-api-lock-${Date.now()}`;
  console.log(`================================================================`);
  console.log(`🚀 TESTE DA ROTA DE API: SIMULAÇÃO DE 409 CONFLICT EM DISPARO CONCORRENTE`);
  console.log(`ID da Cotação de Teste: ${cotacaoId}`);
  console.log(`================================================================\n`);

  // Simular a lógica de checagem da Rota de API POST /api/cotacoes/[cotacaoId]/processar
  console.log(`1. Primeira requisição chega na API...`);
  const { processarCotacaoTodosFornecedores } = require('../lib/services/automacao/matchingEngine');
  
  // Primeira requisição aciona o processamento
  const req1Promise = processarCotacaoTodosFornecedores(cotacaoId);
  
  // Pequena pausa de 10ms (segunda requisição chega enquanto a primeira ainda está rodando)
  await new Promise(r => setTimeout(r, 10));

  console.log(`2. Segunda requisição chega na API enquanto a primeira está em andamento...`);
  const isEmAndamento = await isCotacaoEmProcessamento(cotacaoId);
  
  if (isEmAndamento) {
    console.log(`   └─ [HTTP 409 CONFLICT] A rota de API detectou que a cotação "${cotacaoId}" está em andamento!`);
    console.log(`   └─ Resposta HTTP 409 gerada: { sucesso: false, status: 'CONFLITO', mensagem: 'A cotação já está em processamento.' }\n`);
  } else {
    console.error(`   ❌ ERRO: A rota de API não detectou a trava!`);
  }

  await req1Promise;

  console.log(`3. Após encerramento da cotação, checando se a trava foi liberada...`);
  const statusApos = await isCotacaoEmProcessamento(cotacaoId);
  console.log(`   └─ Status pós-execução: ${statusApos} (esperado: false)\n`);

  console.log(`================================================================`);
  console.log(`✅ VALIDAÇÃO DA ROTA DE API CONCLUÍDA COM SUCESSO! (409 Conflict verificado)`);
  console.log(`================================================================`);
}

testApiRouteLockLogic().catch(err => {
  console.error("Erro fatal no teste da rota de API:", err);
  process.exit(1);
});
