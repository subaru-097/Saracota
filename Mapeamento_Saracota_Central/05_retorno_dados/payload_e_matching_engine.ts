/**
 * ETAPA 6: PERSISTÊNCIA DOS DADOS E FORMATO DO PAYLOAD
 * 
 * Trechos extraídos de lib/services/automacao/matchingEngine.ts
 * Organiza a gravação no banco de dados e a geração do payload de resultados.
 */

import { db } from '@/lib/db/client';

export interface ItemMatchResultado {
  itemPedido: string;
  status: 'CONFIRMADO' | 'SIMILAR' | 'NAO_ENCONTRADO';
  confianca: number;
  produtoEncontrado?: string;
  preco: number;
  quantidade?: number;
  fornecedorId?: string;
}

/**
 * Mapeia 1-para-1 os produtos extraídos pelo robô no carrinho da Cicalfer
 * com a lista de itens solicitada pelo cliente e persiste no banco.
 */
export async function salvarERetornarPayloadCotacao(
  cotacaoId: string,
  fornecedorId: string,
  itensAdicionadosMap: any[],
  cartProdutos: any[],
  totalCarrinho: number,
  cartUrl: string
) {
  const itensProcessados: ItemMatchResultado[] = [];
  const usedCartIndices = new Set<number>();

  let itemIdxLoop = 0;
  for (const addedInfo of itensAdicionadosMap) {
    const nomeItem = addedInfo.termo || 'Produto';
    const targetTitle = (addedInfo.tituloProduto || '').toLowerCase();
    const targetRef = (addedInfo.tituloProduto || nomeItem).match(/\b\d{4,5}\b/)?.[0] || '';

    let chosenCpIdx = -1;

    // Prioridade 1: Match por Referência numérica (Ex: REF: 11239)
    if (targetRef) {
      chosenCpIdx = cartProdutos.findIndex((cp: any, idx: number) => {
        if (usedCartIndices.has(idx)) return false;
        const pName = (cp.nomeProduto || cp.nome || '').toLowerCase();
        return pName.includes(targetRef);
      });
    }

    // Prioridade 2: Título exato retornado na busca
    if (chosenCpIdx === -1 && targetTitle) {
      chosenCpIdx = cartProdutos.findIndex((cp: any, idx: number) => {
        if (usedCartIndices.has(idx)) return false;
        const pName = (cp.nomeProduto || cp.nome || '').toLowerCase();
        return pName.includes(targetTitle) || targetTitle.includes(pName);
      });
    }

    // Prioridade 3: Posição sequencial se equivalente
    if (chosenCpIdx === -1 && itemIdxLoop < cartProdutos.length && !usedCartIndices.has(itemIdxLoop)) {
      chosenCpIdx = itemIdxLoop;
    }

    let matchedItem: any = null;
    if (chosenCpIdx !== -1) {
      matchedItem = cartProdutos[chosenCpIdx];
      usedCartIndices.add(chosenCpIdx);
    }

    itemIdxLoop++;

    if (matchedItem && matchedItem.precoUnitario > 0) {
      const nomeFinal = matchedItem.nomeProduto || addedInfo.tituloProduto || nomeItem;
      const precoUnit = Number(matchedItem.precoUnitario) || 0;
      const qtd = Number(matchedItem.quantidade) || 1;

      itensProcessados.push({
        itemPedido: nomeItem,
        status: 'CONFIRMADO',
        confianca: 95,
        produtoEncontrado: nomeFinal,
        preco: precoUnit,
        quantidade: qtd,
        fornecedorId,
      });
    } else {
      itensProcessados.push({
        itemPedido: nomeItem,
        status: 'NAO_ENCONTRADO',
        confianca: 0,
        preco: 0,
        quantidade: 1,
        fornecedorId,
      });
    }
  }

  // 1. Salvar os resultados do matching no banco para este fornecedor
  await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensProcessados);

  // 2. Formato final do Payload estruturado para consumo no frontend
  return {
    cotacaoId,
    fornecedorId,
    fornecedorNome: 'Cicalfer Material Elétrico',
    urlCarrinhoDireto: cartUrl,
    valorTotalGeral: totalCarrinho,
    itens: itensProcessados,
  };
}
