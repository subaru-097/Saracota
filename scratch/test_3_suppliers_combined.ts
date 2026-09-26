import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import crypto from 'crypto';

import { db, supabase } from '@/lib/db/client';
import { processarCotacaoTodosFornecedores } from '@/lib/services/automacao/matchingEngine';

async function runTest() {
  console.log('================================================================');
  console.log('🚀 TESTE COMBINADO 3 FORNECEDORES (CONSTRUJÁ, CICALFER, COFEMA)');
  console.log('================================================================');

  const timestamp = new Date().toISOString();
  
  // 1. Obter IDs dos 3 fornecedores no Supabase
  const forns = await db.fornecedores.list();
  const cicalfer = forns.find(f => (f.config_slug || (f as any).configSlug) === 'cicalfer');
  const construja = forns.find(f => (f.config_slug || (f as any).configSlug) === 'construja');
  const cofema = forns.find(f => (f.config_slug || (f as any).configSlug) === 'cofema');

  if (!cicalfer || !construja || !cofema) {
    console.error('❌ Nem todos os 3 fornecedores foram encontrados no DB!');
    console.log({ cicalfer: !!cicalfer, construja: !!construja, cofema: !!cofema });
    process.exit(1);
  }

  console.log(`📌 Fornecedores Selecionados:`);
  console.log(`  1. Cicalfer: ${cicalfer.id} (${cicalfer.nome})`);
  console.log(`  2. Construjá: ${construja.id} (${construja.nome})`);
  console.log(`  3. Cofema: ${cofema.id} (${cofema.nome})`);

  // 2. Definir os 5 itens do teste oficial
  const itensTeste = [
    { material: 'DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 6, unidade: 'un', categoria: 'eletrica' },
    { material: 'BIANCO 900G', quantidade: 4, unidade: 'un', categoria: 'construcao' },
    { material: 'DUCHA LORENZETTI MAXI DUCHA 127V', quantidade: 7, unidade: 'un', categoria: 'eletrica' },
    { material: 'ALICATE BOMBA D AGUA MTX 10', quantidade: 12, unidade: 'un', categoria: 'ferramentas' },
    { material: 'CONDUITE CORR AM FORTLEV 25MM 50M', quantidade: 5, unidade: 'un', categoria: 'eletrica' }
  ];

  // 3. Criar Cotação de Teste no Supabase DB
  const cotacaoId = crypto.randomUUID();
  const supplierIds = [cicalfer.id, construja.id, cofema.id];

  if (supabase) {
    const { error: errInsert } = await supabase.from('cotacoes').insert([{
      id: cotacaoId,
      status: 'pendente',
      valor_total: 0,
      fornecedores_selecionados: supplierIds,
      itens: itensTeste,
      criado_em: timestamp,
      user_id: '61ab64e4-c2cb-46df-bb14-6cc326293085'
    }]);

    if (errInsert) {
      console.error('❌ Erro ao criar cotação no Supabase:', errInsert);
      process.exit(1);
    }
  }

  console.log(`\n📋 Cotação de Teste criada com ID: "${cotacaoId}" com 5 itens e 3 fornecedores.\n`);

  // 4. Executar orquestração via processarCotacaoTodosFornecedores
  console.log('================================================================');
  console.log('🔄 INICIANDO ORQUESTRACÃO DOS 3 FORNECEDORES...');
  console.log('================================================================\n');

  const startOrchTime = Date.now();
  await processarCotacaoTodosFornecedores(cotacaoId);
  const totalOrchDuration = ((Date.now() - startOrchTime) / 1000).toFixed(1);

  console.log(`\n================================================================`);
  console.log(`✅ ORQUESTRAÇÃO FINALIZADA EM ${totalOrchDuration}s!`);
  console.log('================================================================\n');

  // 5. Auditando Persistência e Isolamento no Supabase
  console.log('📊 AUDITANDO PERSISTÊNCIA E ISOLAMENTO NO SUPABASE DB...\n');

  let dbItensCotacao: any[] = [];
  let dbItensFornec: any[] = [];

  if (supabase) {
    const { data: res1 } = await supabase.from('cotacao_itens').select('*').eq('cotacao_id', cotacaoId);
    dbItensCotacao = res1 || [];

    const { data: res2 } = await supabase.from('itens_cotacao_fornecedor').select('*').eq('cotacao_id', cotacaoId);
    dbItensFornec = res2 || [];
  }

  const resultadosMatching = await db.cotacoes.obterResultadosMatching(cotacaoId);

  console.log(`Tabela cotacao_itens: ${dbItensCotacao.length} registros salvos.`);
  console.log(`Tabela itens_cotacao_fornecedor: ${dbItensFornec.length} registros salvos.`);
  console.log(`Função obterResultadosMatching: ${resultadosMatching.length} registros totais.\n`);

  const auditPorFornecedor = supplierIds.map(fId => {
    const fObj = forns.find(f => f.id === fId);
    const fNome = fObj?.nome || fId;
    const itensF = dbItensCotacao.filter(it => it.fornecedor_id === fId);
    const resultF = resultadosMatching.filter((it: any) => it.fornecedorId === fId);

    const totalCalculado = resultF.reduce((acc: number, it: any) => acc + (Number(it.preco || 0) * Number(it.quantidade || 1)), 0);

    return {
      fornecedorId: fId,
      fornecedorNome: fNome,
      slug: (fObj as any)?.config_slug || (fObj as any)?.configSlug,
      registrosCotacaoItens: itensF.length,
      registrosMatching: resultF.length,
      totalGeral: totalCalculado,
      itens: resultF.map((it: any) => ({
        itemPedido: it.itemPedido,
        produtoEncontrado: it.produtoEncontrado,
        status: it.status,
        confianca: it.confianca,
        precoUnitario: it.preco,
        quantidade: it.quantidade,
        totalItem: (Number(it.preco) * Number(it.quantidade || 1)).toFixed(2),
        marcaSubstituida: it.marcaSubstituida || false,
        marcaSolicitada: it.marcaSolicitada || null,
        marcaCotada: it.marcaCotada || it.produtoEncontrado || null
      }))
    };
  });

  console.log('=== DETALHAMENTO DE RESULTADOS ISOLADOS POR FORNECEDOR ===');
  console.dir(auditPorFornecedor, { depth: null });

  console.log('\n================================================================');
  console.log('🏁 TESTE COMBINADO CONCLUÍDO!');
  console.log('================================================================');
}

runTest().then(() => process.exit(0)).catch(err => {
  console.error('❌ Erro fatal no teste combinado:', err);
  process.exit(1);
});
