/**
 * ETAPA 7: CÁLCULOS E FORMATAÇÃO DE RESULTADOS
 * 
 * Trechos extraídos de lib/utils.ts e CotacoesView.tsx
 * Demonstra as funções de formatação monetária BRL e cálculo automático de totais.
 */

/**
 * Formata um valor numérico float para string no formato de moeda brasileira (R$ 1.234,56)
 */
export function formatCurrencyBRL(val: number): string {
  const safeNum = isNaN(val) || !isFinite(val) ? 0 : val;
  return safeNum.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Recalcula o subtotal de cada item (Preço Unitário x Quantidade)
 * e calcula o Somatório Total Geral do Pedido.
 */
export function calcularTotaisCarrinho(itensCotados: Array<{ precoUnitario: number; quantidade: number }>) {
  const itensComSubtotal = itensCotados.map((it) => {
    const unitPrice = Number(it.precoUnitario) || 0;
    const qtd = Number(it.quantidade) || 1;
    const subtotalItem = Number((unitPrice * qtd).toFixed(2));

    return {
      ...it,
      precoUnitario: unitPrice,
      quantidade: qtd,
      subtotalItem,
    };
  });

  const valorProdutos = itensComSubtotal.reduce((acc, item) => acc + item.subtotalItem, 0);
  const valorTotalGeral = Number(valorProdutos.toFixed(2));

  return {
    itensComSubtotal,
    valorProdutos,
    valorTotalGeral,
    totalFormatado: formatCurrencyBRL(valorTotalGeral),
  };
}
