import { Produto, MatchingType, AtributosTecnicos } from '@/types';

export interface MatchResult {
  produto: Produto;
  confidenceScorePercent: number; // 0 - 100%
  matchingStatus: MatchingType;
  motivoDiferenca?: string;
  unidadeSugerida: string;
  fatorConversao: number;
  detalhesCalculo: {
    atributoScore: number;
    textFuzzyScore: number;
    categoriaScore: number;
  };
}

/**
 * Distância de Levenshtein para pontuação de fuzzy match entre duas strings
 */
export function calcularLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const str1 = a.toLowerCase();
  const str2 = b.toLowerCase();

  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str1.length][str2.length];
}

/**
 * Calcula a porcentagem de similaridade fuzzy entre duas strings (0 a 100%)
 */
export function calcularFuzzySimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();

  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;

  // Matching por tokens (palavras em comum)
  const tokens1 = s1.split(/\s+/);
  const tokens2 = s2.split(/\s+/);
  const tokensEmComum = tokens1.filter((t) => tokens2.includes(t));
  const tokenRatio = (tokensEmComum.length / Math.max(tokens1.length, tokens2.length)) * 100;

  // Distância de Levenshtein
  const maxLen = Math.max(s1.length, s2.length);
  const distance = calcularLevenshteinDistance(s1, s2);
  const levenshteinRatio = ((maxLen - distance) / maxLen) * 100;

  // Combinação ponderada de tokens + Levenshtein
  return Math.round(tokenRatio * 0.6 + levenshteinRatio * 0.4);
}

/**
 * Converte unidades industriais de construção para comparação equivalente de preços
 */
export function converterUnidade(
  quantidade: number,
  unidadeOrigem: string,
  unidadeDestino: string,
  fatorConversaoProduto: number = 100
): { quantidadeConvertida: number; fator: number } {
  const normOrigem = unidadeOrigem.toLowerCase();
  const normDestino = unidadeDestino.toLowerCase();

  if (normOrigem === normDestino) {
    return { quantidadeConvertida: quantidade, fator: 1 };
  }

  // Rolo (100m) <-> Metro (m)
  if (normOrigem.includes('rolo') && normDestino.includes('metro')) {
    return { quantidadeConvertida: quantidade * fatorConversaoProduto, fator: fatorConversaoProduto };
  }
  if (normOrigem.includes('metro') && normDestino.includes('rolo')) {
    return { quantidadeConvertida: quantidade / fatorConversaoProduto, fator: 1 / fatorConversaoProduto };
  }

  // Vara / Barra (6m) <-> Metro
  if (normOrigem.includes('vara') || normOrigem.includes('barra')) {
    return { quantidadeConvertida: quantidade * 6, fator: 6 };
  }

  return { quantidadeConvertida: quantidade, fator: 1 };
}

/**
 * Processa o Matching Técnico avançado com Fuzzy Search + Pontuação de Confiança (0-100%)
 */
export function processarMatchingTecnico(
  query: string,
  atributosFiltro: AtributosTecnicos | undefined,
  catalogo: Produto[]
): MatchResult[] {
  if (!query.trim()) {
    return catalogo.map((prod) => ({
      produto: prod,
      confidenceScorePercent: 100,
      matchingStatus: 'exato',
      unidadeSugerida: prod.unidadeBase,
      fatorConversao: 1,
      detalhesCalculo: { atributoScore: 100, textFuzzyScore: 100, categoriaScore: 100 },
    }));
  }

  return catalogo
    .map((prod) => {
      // 1. Text Fuzzy Score (40% peso)
      const textFuzzyScore = Math.max(
        calcularFuzzySimilarity(query, prod.nome),
        calcularFuzzySimilarity(query, prod.sku),
        query.includes(prod.ncm) ? 100 : 0
      );

      // 2. Atributos Técnicos Score (40% peso)
      let atributoScore = 50; // Base neutra
      const qUpper = query.toUpperCase();

      const hasBitolaMatch =
        (atributosFiltro?.bitola && prod.atributos.bitola === atributosFiltro.bitola) ||
        (prod.atributos.bitola && qUpper.includes(prod.atributos.bitola.toUpperCase()));

      const hasTensaoMatch =
        (atributosFiltro?.tensao && prod.atributos.tensao === atributosFiltro.tensao) ||
        (prod.atributos.tensao && qUpper.includes(prod.atributos.tensao.toUpperCase()));

      const hasDiametroMatch =
        (atributosFiltro?.diametro && prod.atributos.diametro === atributosFiltro.diametro) ||
        (prod.atributos.diametro && qUpper.includes(prod.atributos.diametro.toUpperCase()));

      if (hasBitolaMatch || hasTensaoMatch || hasDiametroMatch) {
        atributoScore = 100;
      }

      // 3. Categoria Score (20% peso)
      const categoriaScore = 80;

      // Pontuação Final de Confiança Ponderada (0-100%)
      const confidenceScorePercent = Math.round(
        textFuzzyScore * 0.4 + atributoScore * 0.4 + categoriaScore * 0.2
      );

      let matchingStatus: MatchingType = 'indisponivel';
      let motivoDiferenca: string | undefined;

      if (confidenceScorePercent >= 85) {
        matchingStatus = 'exato';
      } else if (confidenceScorePercent >= 50) {
        matchingStatus = 'similar';
        motivoDiferenca = 'Marca ou variação secundária compatível (Fuzzy match > 50%)';
      } else {
        matchingStatus = 'indisponivel';
        motivoDiferenca = 'Especificação técnica não compatível com o pedido';
      }

      return {
        produto: prod,
        confidenceScorePercent,
        matchingStatus,
        motivoDiferenca,
        unidadeSugerida: prod.unidadeBase,
        fatorConversao: prod.fatorConversaoMetro || 1,
        detalhesCalculo: { atributoScore, textFuzzyScore, categoriaScore },
      };
    })
    .filter((res) => res.confidenceScorePercent > 20)
    .sort((a, b) => b.confidenceScorePercent - a.confidenceScorePercent);
}
