import { processarCotacaoFornecedor } from '../lib/services/automacao/matchingEngine';
import { db, supabase } from '../lib/db/client';

async function runE2ETestColorgin() {
  console.log('=== STARTING CONTROLLED E2E TEST: COLORGIN 4 ITEMS (CONSTRUJÁ) ===');

  const cotacaoId = 'c56a8d79-994c-4e89-98bf-925fb3b34201'; // Valid UUID format
  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';

  // 1. Fetch supplier config from DB
  const supplier = await db.fornecedores.getById(construjaId);
  if (!supplier) {
    throw new Error('Fornecedor Construjá não encontrado no banco!');
  }

  // Define 4 Colorgin promo items
  const itens = [
    { id: 'item-1', material: 'spray decor preto colorgin 360ml', quantidade: 1 },
    { id: 'item-2', material: 'spray decor marrom colorgin 360ml', quantidade: 1 },
    { id: 'item-3', material: 'spray decor amarelo colorgin 360ml', quantidade: 1 },
    { id: 'item-4', material: 'spray decor cinza colorgin 360ml', quantidade: 1 }
  ];

  console.log('Creating parent quote record in Supabase cotacoes table...');
  if (supabase) {
    // Get valid user_id from database
    const { data: uRec } = await supabase.from('fornecedores').select('user_id').not('user_id', 'is', null).limit(1).maybeSingle();
    const validUserId = uRec?.user_id;

    try {
      await supabase.from('cotacao_itens').delete().eq('cotacao_id', cotacaoId);
      await supabase.from('itens_cotacao_fornecedor').delete().eq('cotacao_id', cotacaoId);
      await supabase.from('cotacoes').delete().eq('id', cotacaoId);
    } catch (e) {}

    const { error: insErr } = await supabase.from('cotacoes').insert({
      id: cotacaoId,
      user_id: validUserId,
      status: 'em_analise',
      valor_total: 0,
      itens: itens,
      fornecedores_selecionados: [construjaId]
    });
    if (insErr) {
      console.log('Notice on insert parent cotacoes:', insErr.message);
    } else {
      console.log('✅ Parent quote created successfully in Supabase cotacoes table!');
    }
  }

  const createdQuote = await db.cotacoes.create({
    id: cotacaoId,
    status: 'EM_PROCESSAMENTO',
    valor_total: 0,
    itens: itens,
    fornecedor_id: construjaId,
    fornecedores_selecionados: [construjaId]
  });

  // Ensure global cache store has it
  if (!(globalThis as any).__saracota_quotes_store) {
    (globalThis as any).__saracota_quotes_store = {};
  }
  (globalThis as any).__saracota_quotes_store[cotacaoId] = createdQuote;

  console.log(`Cotacao parent record created with ID: ${cotacaoId}`);
  console.log('Submitting quote to processarCotacaoFornecedor...');

  // 2. Execute processarCotacaoFornecedor
  const result = await processarCotacaoFornecedor(
    cotacaoId,
    construjaId,
    async (msg: string) => {
      console.log(`[PROGRESS] ${msg}`);
    }
  );

  console.log('\n========================================');
  console.log('=== ETAPA 1: EXTRAÇÃO DO CARRINHO (BRUTA) ===');
  console.log('========================================');
  console.log('Itens Extraídos do Carrinho (esperado = R$ 14.55 promocional):');
  result.itensProcessados.forEach((it: any, i: number) => {
    console.log(`[Carrinho Item ${i + 1}] "${it.produtoEncontrado}" | Preço Promocional Extraído: R$ ${it.preco}`);
  });

  console.log('\n========================================');
  console.log('=== ETAPA 2: VALOR NO MATCHING / SCORING (itensProcessados) ===');
  console.log('========================================');
  if (result.itensProcessados) {
    result.itensProcessados.forEach((item: any, idx: number) => {
      console.log(`[Matching Item ${idx + 1}] Pedido: "${item.itemPedido}" | Encontrado: "${item.produtoEncontrado}" | Status: ${item.status} | Unitario: R$ ${item.preco}`);
    });
  }

  console.log('\n========================================');
  console.log('=== ETAPA 3: VALOR PERSISTIDO NO SUPABASE (cotacao_itens) ===');
  console.log('========================================');
  
  if (supabase) {
    const { data: dbItems, error: selErr } = await supabase
      .from('cotacao_itens')
      .select('*')
      .eq('cotacao_id', cotacaoId)
      .eq('fornecedor_id', construjaId);

    if (selErr) {
      console.log('Erro ao consultar cotacao_itens:', selErr.message);
    }

    if (dbItems && dbItems.length > 0) {
      console.log('Itens persistidos com sucesso na tabela cotacao_itens do Supabase:');
      dbItems.forEach((d: any, i: number) => {
        console.log(`[Supabase DB Item ${i + 1}] Produto: "${d.nome || d.material}" | Preço Persistido: R$ ${d.preco_unitario} | Total Item: R$ ${d.total_item}`);
      });
    } else {
      console.log('Nenhum item localizado na tabela cotacao_itens.');
    }
  }

  console.log('\n=== FIM DO TESTE CONTROLADO ===');
}

runE2ETestColorgin().catch(err => {
  console.error('FATAL ERROR IN TEST:', err);
  process.exit(1);
});
