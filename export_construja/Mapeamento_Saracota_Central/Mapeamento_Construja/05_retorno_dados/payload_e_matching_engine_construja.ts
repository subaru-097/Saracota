/**
 * ETAPA 5: PERSISTÊNCIA E RETORNO DOS RESULTADOS DA CONSTRUJÁ NO BANCO SUPABASE
 */

import { db } from '@/lib/db/client';

export interface ResultadoItemConstruja {
  itemPedido: string;
  produtoEncontrado: string;
  precoUnitario: number;
  precoTotalItem: number;
  quantidade: number;
  status: 'CONFIRMADO' | 'NAO_ENCONTRADO';
  fornecedorId: string; // "a1684c4d-d896-4ba9-a591-cda455c5ffe2"
}

export async function salvarResultadosConstruja(
  cotacaoId: string,
  resultados: ResultadoItemConstruja[]
) {
  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';

  // 1. Grava no cache de memória e tabelas Supabase (itens_cotacao_fornecedor)
  await db.cotacoes.salvarResultadosMatching(cotacaoId, construjaId, resultados);

  // 2. Atualiza progresso da cotação para 'aguardando_revisao' (100% concluído)
  await db.cotacoes.salvarProgresso(cotacaoId, {
    status: 'aguardando_revisao',
    itensProcessados: resultados.length,
    totalItens: resultados.length,
    percentualConcluido: 100,
    mensagens: [
      `Cotação concluída com sucesso para o fornecedor Construjá.`,
      `${resultados.filter(r => r.status === 'CONFIRMADO').length} item(ns) cotado(s) com preços reais.`
    ]
  });

  return true;
}
