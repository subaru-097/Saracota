import { db, supabase } from '../lib/db/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function runVerificationTest() {
  console.log('=== TESTE REAL E2E DE VALIDAÇÃO DA CORREÇÃO DA TABELA "cotacoes" ===');

  const realUserId = '61ab64e4-c2cb-46df-bb14-6cc326293085';
  const testCotacaoId = crypto.randomUUID();

  const payloadCotacao = {
    id: testCotacaoId,
    user_id: realUserId,
    fornecedorIds: ['33e03495-100d-45a3-9e34-899de56b0ab1'],
    fornecedores_selecionados: ['33e03495-100d-45a3-9e34-899de56b0ab1'],
    obraNome: 'Obra Reserva das Palmeiras (Validação Fix)',
    valor_total: 4500.00,
    status: 'pendente',
    itens: [
      {
        material: "CAIXA DE ÁGUA FECHADA FORTLEV 310 LITROS",
        quantidade: 5,
        unidade: "un",
        preco_unitario: 438.03,
        categoria: "hidraulica"
      },
      {
        material: "DUCHA LORENZETTI MAXI DUCHA 127V",
        quantidade: 5,
        unidade: "un",
        preco_unitario: 83.44,
        categoria: "eletrica"
      },
      {
        material: "BIANCO OTTO 900G",
        quantidade: 10,
        unidade: "un",
        preco_unitario: 31.35,
        categoria: "hidraulica"
      }
    ]
  };

  console.log(`\nPasso 1: Invocando db.cotacoes.create() com UUID "${testCotacaoId}"...`);
  const resultadoCreate = await db.cotacoes.create(payloadCotacao);
  console.log('✓ Retorno da função db.cotacoes.create():', { id: resultadoCreate.id, status: resultadoCreate.status });

  console.log(`\nPasso 2: Efetuando SELECT direto na tabela "cotacoes" do Supabase PostgreSQL para o ID "${resultadoCreate.id}"...`);
  if (!supabase) {
    throw new Error('Supabase client não está configurado!');
  }

  const { data: recordFromDb, error: selectErr } = await supabase
    .from('cotacoes')
    .select('*')
    .eq('id', resultadoCreate.id)
    .single();

  if (selectErr) {
    console.error('❌ ERRO NO SELECT APÓS INSERT:', selectErr);
    throw selectErr;
  }

  console.log('\n====================================================');
  console.log('✅ REGISTRO CONFIRMADO GRAVADO NO BANCO SUPABASE POSTGRESQL:');
  console.log(JSON.stringify(recordFromDb, null, 2));
  console.log('====================================================\n');

  console.log('=== TESTE DE VALIDAÇÃO CONCLUÍDO COM 100% DE SUCESSO ===');
}

runVerificationTest().catch((err) => {
  console.error('❌ TESTE FALHOU:', err);
  process.exit(1);
});
