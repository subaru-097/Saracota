import { ItemCotacaoFornecedorPreco, Fornecedor } from '@/types';

export interface SupplierRankingItem {
  fornecedorId: string;
  fornecedorNome: string;
  valorTotalProdutos: number;
  valorTotalST: number;
  valorTotalGeral: number;
  prazoEntregaHoras: number;
  slaMinutos: number;
  scoreConfiabilidade: number; // 0.0 - 5.0
  compositeScore: number;     // 0 - 100
  badgeRecomendacao?: 'melhor_geral' | 'menor_preco' | 'entrega_rapida';
  badgeTexto?: string;
}

export interface MatrizComparativaResultado {
  rankings: SupplierRankingItem[];
  vencedorGeral: SupplierRankingItem;
  vencedorMenorPreco: SupplierRankingItem;
  vencedorEntregaRapida: SupplierRankingItem;
  diferencaEconomiaMaxBRL: number;
}

/**
 * Calcula o Ranking e Matriz Comparativa Completa entre Fornecedores
 * combinando Preço (50%), SLA & Confiabilidade (25%) e Prazo de Entrega (25%)
 */
export function calcularMatrizComparativa(
  itensCotacao: { precosFornecedores: ItemCotacaoFornecedorPreco[]; quantidade: number }[],
  fornecedoresCredenciados: Fornecedor[]
): MatrizComparativaResultado {
  // 1. Agrupar totais por fornecedor
  const fornecedorTotaisMap: Map<
    string,
    { fornecedorId: string; fornecedorNome: string; totalProdutos: number; totalST: number; totalGeral: number }
  > = new Map();

  itensCotacao.forEach((item) => {
    item.precosFornecedores.forEach((fp) => {
      const existing = fornecedorTotaisMap.get(fp.fornecedorId) || {
        fornecedorId: fp.fornecedorId,
        fornecedorNome: fp.fornecedorNome,
        totalProdutos: 0,
        totalST: 0,
        totalGeral: 0,
      };

      const subtotalP = fp.precoUnitario * item.quantidade;
      const subtotalST = fp.resultadoST.valorSTTotal;

      existing.totalProdutos += subtotalP;
      existing.totalST += subtotalST;
      existing.totalGeral += subtotalP + subtotalST;

      fornecedorTotaisMap.set(fp.fornecedorId, existing);
    });
  });

  const listaTotais = Array.from(fornecedorTotaisMap.values());
  if (listaTotais.length === 0) {
    throw new Error('Nenhum fornecedor encontrado na lista de cotação.');
  }

  // Encontrar valores de referência min/max para normalização
  const minPrecoGeral = Math.min(...listaTotais.map((l) => l.totalGeral));
  const maxPrecoGeral = Math.max(...listaTotais.map((l) => l.totalGeral));

  // 2. Pontuar cada fornecedor
  const rankings: SupplierRankingItem[] = listaTotais.map((tot) => {
    const infoForn = fornecedoresCredenciados.find((f) => f.id === tot.fornecedorId) || {
      slaMinutos: 20,
      scoreConfiabilidade: 4.8,
    };

    // Prazo estimado em horas simulado (ex: 24h para Elétrica SP, 48h para Central, 36h para ABC)
    const prazoEntregaHoras = tot.fornecedorId === 'forn-01' ? 24 : tot.fornecedorId === 'forn-02' ? 48 : 36;

    // Score de Preço (50% do peso): quanto menor o preço, maior a pontuação (100 a 0)
    const priceScore = maxPrecoGeral === minPrecoGeral
      ? 100
      : 100 - ((tot.totalGeral - minPrecoGeral) / (maxPrecoGeral - minPrecoGeral)) * 100;

    // Score de SLA & Confiabilidade (25% do peso)
    const slaScore = (infoForn.scoreConfiabilidade / 5.0) * 80 + (1 / Math.max(1, infoForn.slaMinutos)) * 20 * 10;
    const slaNormalized = Math.min(100, Math.max(0, slaScore));

    // Score de Prazo de Entrega (25% do peso): menor prazo = maior score
    const deliveryScore = Math.max(0, 100 - (prazoEntregaHoras / 72) * 50);

    // Composite Score Ponderado (0-100)
    const compositeScore = Math.round(priceScore * 0.5 + slaNormalized * 0.25 + deliveryScore * 0.25);

    return {
      fornecedorId: tot.fornecedorId,
      fornecedorNome: tot.fornecedorNome,
      valorTotalProdutos: Number(tot.totalProdutos.toFixed(2)),
      valorTotalST: Number(tot.totalST.toFixed(2)),
      valorTotalGeral: Number(tot.totalGeral.toFixed(2)),
      prazoEntregaHoras,
      slaMinutos: infoForn.slaMinutos,
      scoreConfiabilidade: infoForn.scoreConfiabilidade,
      compositeScore,
    };
  });

  // Ordenar rankings
  const rankingsByScore = [...rankings].sort((a, b) => b.compositeScore - a.compositeScore);
  const rankingsByPreco = [...rankings].sort((a, b) => a.valorTotalGeral - b.valorTotalGeral);
  const rankingsByEntrega = [...rankings].sort((a, b) => a.prazoEntregaHoras - b.prazoEntregaHoras);

  const vencedorGeral = rankingsByScore[0];
  const vencedorMenorPreco = rankingsByPreco[0];
  const vencedorEntregaRapida = rankingsByEntrega[0];

  // Atribuir badges de recomendação
  rankings.forEach((r) => {
    if (r.fornecedorId === vencedorGeral.fornecedorId) {
      r.badgeRecomendacao = 'melhor_geral';
      r.badgeTexto = '🥇 Melhor Opção Geral (Custo-Benefício)';
    } else if (r.fornecedorId === vencedorMenorPreco.fornecedorId) {
      r.badgeRecomendacao = 'menor_preco';
      r.badgeTexto = '💰 Menor Preço Líquido';
    } else if (r.fornecedorId === vencedorEntregaRapida.fornecedorId) {
      r.badgeRecomendacao = 'entrega_rapida';
      r.badgeTexto = '⚡ Entrega Mais Rápida (24h)';
    }
  });

  const diferencaEconomiaMaxBRL = Number((maxPrecoGeral - minPrecoGeral).toFixed(2));

  return {
    rankings: rankingsByScore,
    vencedorGeral,
    vencedorMenorPreco,
    vencedorEntregaRapida,
    diferencaEconomiaMaxBRL,
  };
}
