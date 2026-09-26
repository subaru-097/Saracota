/**
 * Módulo de Normalização de Preço por Unidade-Base (Saracota)
 * 
 * Converte preços de embalagens/formatos de venda (ex: Rolo 100m, Barra 6m, Caixa 50un, Saco 50kg)
 * para uma unidade-base comparável (ex: R$/metro, R$/unidade, R$/kg).
 */

export interface PrecoNormalizadoResultado {
  precoOriginal: number;
  unidadeOriginal: string;
  unidadeBase: 'metro' | 'unidade' | 'kg' | 'litro' | 'caixa';
  fatorConversaoBase: number;
  precoUnitarioBase: number;
}

export function normalizarPrecoPorUnidade(
  precoOriginal: number,
  unidadeOriginalStr: string,
  nomeProduto?: string
): PrecoNormalizadoResultado {
  const preco = Number(precoOriginal) || 0;
  const unStrUpper = (unidadeOriginalStr || '').toUpperCase().trim();
  const nomeUpper = (nomeProduto || '').toUpperCase().trim();

  let unidadeBase: 'metro' | 'unidade' | 'kg' | 'litro' | 'caixa' = 'unidade';
  let fatorConversao = 1.0;

  // 1. Verificação de Metragem (Rolo Xm ou Barra Ym)
  const matchMetrosRolo = (unStrUpper + ' ' + nomeUpper).match(/\b(?:ROLO|CX|PACOTE)?\s*(\d+(?:[.,]\d+)?)\s*(?:M|METRO|METROS)\b/i);
  const matchBarra = (unStrUpper + ' ' + nomeUpper).match(/\bBARRA\s*(\d+(?:[.,]\d+)?)?\s*(?:M|METRO|METROS)?\b/i);

  if (matchMetrosRolo && matchMetrosRolo[1]) {
    const metros = parseFloat(matchMetrosRolo[1].replace(',', '.'));
    if (metros > 0) {
      unidadeBase = 'metro';
      fatorConversao = metros;
    }
  } else if (matchBarra) {
    const metrosBarra = matchBarra[1] ? parseFloat(matchBarra[1].replace(',', '.')) : 6.0; // Padrão barra PVC / ferro = 6m
    unidadeBase = 'metro';
    fatorConversao = metrosBarra > 0 ? metrosBarra : 6.0;
  }

  // 2. Verificação de Quantidade em Pacote/Caixa (ex: Caixa c/ 50 un, Pacote 100 un)
  if (unidadeBase === 'unidade') {
    const matchPacoteCount = (unStrUpper + ' ' + nomeUpper).match(/\b(?:CX|CAIXA|PCT|PACOTE|KIT|C\/)\s*(\d+)\s*(?:UN|PC|PEÇAS|PECA|UNIDADES)?\b/i);
    if (matchPacoteCount && matchPacoteCount[1]) {
      const qte = parseInt(matchPacoteCount[1], 10);
      if (qte > 0) {
        fatorConversao = qte;
      }
    }
  }

  // 3. Verificação de Quilos (ex: Saco 50kg, Galão 18L)
  const matchKg = (unStrUpper + ' ' + nomeUpper).match(/\b(\d+(?:[.,]\d+)?)\s*(?:KG|QUILO|KILOS)\b/i);
  if (matchKg && matchKg[1]) {
    const kg = parseFloat(matchKg[1].replace(',', '.'));
    if (kg > 0) {
      unidadeBase = 'kg';
      fatorConversao = kg;
    }
  }

  const matchL = (unStrUpper + ' ' + nomeUpper).match(/\b(\d+(?:[.,]\d+)?)\s*(?:L|LITRO|LITROS)\b/i);
  if (matchL && matchL[1]) {
    const litros = parseFloat(matchL[1].replace(',', '.'));
    if (litros > 0) {
      unidadeBase = 'litro';
      fatorConversao = litros;
    }
  }

  const precoUnitarioBase = Number((preco / fatorConversao).toFixed(4));

  return {
    precoOriginal: preco,
    unidadeOriginal: unidadeOriginalStr || 'un',
    unidadeBase,
    fatorConversaoBase: fatorConversao,
    precoUnitarioBase,
  };
}
