// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

import { db } from '../lib/db/client';
import { processarCotacaoTodosFornecedores } from '../lib/services/automacao/matchingEngine';

(async () => {
  console.log('================================================================');
  console.log('🧪 TESTE DE RASTREAMENTO AO VIVO: COTAÇÃO COM 1 ITEM NOVO (CHUVEIRO)');
  console.log('================================================================\n');

  const payloadCotacao = {
    obraNome: 'Obra Reforma Banheiro - Chuveiro',
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    fornecedorIds: ['33e03495-100d-45a3-9e34-899de56b0ab1'],
    itens: [
      {
        cotacao_id: '',
        material: 'Chuveiro Lorenzetti Maxi Ducha',
        quantidade: 1,
        unidade: 'un',
        preco_unitario: 0,
        categoria: 'hidraulica',
      },
    ],
  };

  console.log('1. Criando cotação no sistema com APENAS 1 item ("Chuveiro Lorenzetti Maxi Ducha")...');
  const novaCotacao = await db.cotacoes.create(payloadCotacao);
  console.log(`✅ Cotação criada com sucesso! ID: "${novaCotacao.id}"`);

  console.log('\n2. RASTREAMENTO PRE-DISPARO: Lendo cotação diretamente do banco/store via db.cotacoes.getById...');
  const cotacaoLidaDoBanco = await db.cotacoes.getById(novaCotacao.id);

  console.log(`📋 Total de itens lidos para cotacaoId "${novaCotacao.id}": ${cotacaoLidaDoBanco?.itens?.length || 0}`);
  if (cotacaoLidaDoBanco?.itens) {
    cotacaoLidaDoBanco.itens.forEach((it: any, idx: number) => {
      console.log(`   └─ Item ${idx + 1}: "${it.material || it.texto}" | Quantidade: ${it.quantidade}`);
    });
  }

  if ((cotacaoLidaDoBanco?.itens?.length || 0) !== 1) {
    console.error('❌ ERRO: Esperado 1 item, mas foram lidos', cotacaoLidaDoBanco?.itens?.length);
    process.exit(1);
  }

  console.log('\n3. DISPARANDO AUTOMAÇÃO RPA EM BACKGROUND (matchingEngine.ts)...');
  await processarCotacaoTodosFornecedores(novaCotacao.id);

  console.log('\n================================================================');
  console.log('✅ TESTE DE RASTREAMENTO AO VIVO FINALIZADO COM SUCESSO!');
  console.log('================================================================');
})();
