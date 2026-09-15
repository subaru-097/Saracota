import { db } from '../lib/db/client';

(async () => {
  console.log('=== TESTE DE VALIDAÇÃO: db.cotacoes.create() + db.cotacoes.getById() ===');
  
  // 1. Inserir/Upsert de cotação com a obra "Reserva das Palmeiras" e Cicalfer
  const cot = await db.cotacoes.create({
    obraNome: 'Reserva das Palmeiras',
    status: 'pendente',
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    fornecedorIds: ['33e03495-100d-45a3-9e34-899de56b0ab1'],
    itens: [
      { material: "Broca Chata Madeira Irwin", quantidade: 2, unidade: 'un', preco_unitario: 25 },
      { material: "Aplicador Silicone Sparta", quantidade: 1, unidade: 'un', preco_unitario: 35 },
      { material: "Alicate Pressao Curvo MTX", quantidade: 1, unidade: 'un', preco_unitario: 45 },
      { material: "Conduite Corr AM Fortlev", quantidade: 5, unidade: 'un', preco_unitario: 89 }
    ]
  });

  console.log('1. [SUPABASE SUCCESS] db.cotacoes.create / upsert executado com sucesso!');
  console.log(`   - ID da Cotação: "${cot.id}"`);

  // 2. Tentar buscar a cotação recém-criada via db.cotacoes.getById() sem cache local
  // Limpar cache temporário de teste em memória para simular chamada vinda de processo limpo Node server-side
  if ((globalThis as any).__saracota_quotes_store) {
    delete (globalThis as any).__saracota_quotes_store[cot.id];
  }

  const fetched = await db.cotacoes.getById(cot.id);

  console.log('\n2. [SUPABASE LOG TEST db.cotacoes.getById]:');
  if (fetched) {
    console.log(`   ✅ SUCESSO: Cotação ID "${fetched.id}" encontrada no Supabase sem erro PGRST200!`);
    console.log(`   - Status: ${fetched.status}`);
    console.log(`   - Total de itens no array jsonb: ${(fetched as any).itens?.length || 0}`);
  } else {
    console.error(`   ❌ ERRO: Cotação ID "${cot.id}" não foi encontrada.`);
    process.exit(1);
  }
})();
