import { db } from '../lib/db/client';

(async () => {
  console.log('=== TESTE 14 - VALIDAÇÃO CICALFER SOLO (COM DB REAL) ===');

  const novaCotacao = await db.cotacoes.create({
    titulo: 'Teste 14 - Cicalfer Solo',
    status: 'processando',
    obra_id: '861a4ec8-c4ef-4c6e-b6fb-06d9a2a71f09',
    itens: [
      { id: 'item-1', texto: '6x Ducha Lorenzetti Bella Ducha 127V', quantidade: 6, origem: 'texto' },
      { id: 'item-2', texto: '3x Caixa d\'Água Fortlev 310L', quantidade: 3, origem: 'texto' }
    ],
    fornecedores_selecionados: ['33e03495-100d-45a3-9e34-899de56b0ab1']
  });

  const cotacaoId = novaCotacao.id;
  console.log(`Cotação criada no Supabase com ID: ${cotacaoId}`);

  const payload = {
    itens: novaCotacao.itens,
    fornecedorIds: ['33e03495-100d-45a3-9e34-899de56b0ab1']
  };

  const res = await fetch(`http://localhost:3000/api/cotacoes/${cotacaoId}/processar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json());

  console.log('Resposta da API processar:', res);

  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`http://localhost:3000/api/cotacoes/${cotacaoId}/status`).then(r => r.json());
    console.log(`[POLL ${i + 1}] Status: ${statusRes.status} | Pct: ${statusRes.percentualConcluido}%`);
    if (statusRes.status === 'concluida' || statusRes.status === 'concluido' || statusRes.status === 'aguardando_revisao') {
      console.log('--- COTAÇÃO FINALIZADA ---');
      console.log('Mensagens:', statusRes.mensagens);

      const cotDb = await db.cotacoes.getById(cotacaoId);
      console.log('Resultados no banco:', JSON.stringify(cotDb?.itens_cotacao_fornecedor, null, 2));
      break;
    }
  }
})();
