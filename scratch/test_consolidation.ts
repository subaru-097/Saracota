import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { consolidarComparativoCotacao } from '../lib/services/cotacaoConsolidationService';
import { db } from '../lib/db/client';

async function main() {
  const cotacaoId = '2a97a9b3-4130-4f1a-8d71-7d47eb4e111d';
  console.log('=== TEST MATCHING RESULTS ===');
  const rawRes = await db.cotacoes.obterResultadosMatching(cotacaoId);
  console.log('Raw Matching Count:', rawRes.length);
  if (rawRes.length > 0) {
    console.log('Sample Raw Item:', JSON.stringify(rawRes[0], null, 2));
  }

  console.log('\n=== TEST CONSOLIDATION ===');
  const comp = await consolidarComparativoCotacao(cotacaoId, 'SP');
  console.log('Fornecedores Participantes:', JSON.stringify(comp.fornecedoresParticipantes, null, 2));
  console.log('Melhor Fornecedor Unico:', JSON.stringify(comp.melhorFornecedorUnico, null, 2));
  console.log('Cesta Otimizada:', JSON.stringify(comp.cestaOtimizadaSplit, null, 2));
  console.log('Matriz Items Count:', comp.matrizComparativa.length);
  if (comp.matrizComparativa.length > 0) {
    console.log('Sample Matriz Item:', JSON.stringify(comp.matrizComparativa[0], null, 2));
  }
}

main().catch(console.error);
