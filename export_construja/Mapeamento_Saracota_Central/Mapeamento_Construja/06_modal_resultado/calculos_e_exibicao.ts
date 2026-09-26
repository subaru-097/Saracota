/**
 * CÁLCULOS DE AGRUPAMENTO E FORMATAÇÃO DE PREÇOS CONSTRUJÁ
 */

import { formatCurrencyBRL } from '@/lib/utils';

export function calcularResumoConstruja(itens: { precoUnitario: number; quantidade: number }[]) {
  const total = itens.reduce((acc, it) => acc + (it.precoUnitario * it.quantidade), 0);
  return {
    totalFormatado: formatCurrencyBRL(total),
    totalNumerico: total,
    quantidadeItens: itens.length,
  };
}
