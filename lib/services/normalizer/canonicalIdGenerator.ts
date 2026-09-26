import stringSimilarity from 'string-similarity';
import {
  extrairAtributosPorCategoria,
  detectarCategoriaProduto,
  normalizarTextoNLP,
  tokenizarTextoNLP,
  MARCAS_GLOBAIS,
  CORES_GLOBAIS
} from './categorySchemaRegistry';

export interface AtributosEstruturados {
  raw: string;
  marca: string;
  modelo: string;
  voltagem: string; // '127V' | '220V' | '110V' | '750V' | 'BIVOLT' | 'INDISPONIVEL'
  potencia: string; // '6800W' | '7500W' | '5500W' | 'INDISPONIVEL'
  diametro: string;
  amperagem: string;
  cor: string;
  material: string;
  sku: string;
  categoriaId?: string;
  categoriaNome?: string;
}

export interface ResultadoMatchingCamadas {
  status: 'MATCH_EXATO' | 'MATCH_SIMILAR' | 'AMBIGUO_REVISAO_MANUAL';
  scoreConfianca: number; // 0.0 a 1.0
  camadaUtilizada: 1 | 2 | 3 | 0;
  canonicalIdSolicitado: string;
  canonicalIdCandidato: string;
  motivo: string;
  divergencias: string[];
}

export function normalizarTexto(txt: string): string {
  if (!txt) return '';
  return txt
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extrairAtributosEstruturados(rawText: string, skuPreCalculado?: string): AtributosEstruturados {
  const catExtrap = extrairAtributosPorCategoria(rawText);
  const norm = normalizarTexto(rawText);

  const skuMatch = rawText.match(/\b(\d{5,8})\b/);
  const sku = skuPreCalculado || (skuMatch ? skuMatch[1] : 'INDISPONIVEL');

  const marca = catExtrap.atributos['marca'] || 'INDISPONIVEL';
  let voltagem = catExtrap.atributos['voltagem'] || 'INDISPONIVEL';
  if (voltagem === '110V') voltagem = '127V';

  const potencia = catExtrap.atributos['potencia'] || 'INDISPONIVEL';
  const amperagem = catExtrap.atributos['amperagem'] || 'INDISPONIVEL';
  const diametro = catExtrap.atributos['bitola'] || catExtrap.atributos['tamanho_polegadas'] || 'INDISPONIVEL';
  const cor = catExtrap.atributos['cor'] || 'INDISPONIVEL';
  const material = catExtrap.atributos['material'] || 'INDISPONIVEL';
  const modelo = catExtrap.atributos['modelo'] || norm;

  return {
    raw: rawText,
    marca,
    modelo,
    voltagem,
    potencia,
    diametro,
    amperagem,
    cor,
    material,
    sku,
    categoriaId: catExtrap.categoriaId,
    categoriaNome: catExtrap.categoriaNome,
  };
}

export function gerarCanonicalId(atrib: AtributosEstruturados): string {
  const parts: string[] = ['CANON'];

  if (atrib.categoriaId) parts.push(atrib.categoriaId.toUpperCase());
  if (atrib.marca !== 'INDISPONIVEL') parts.push(atrib.marca);
  if (atrib.modelo) parts.push(atrib.modelo.replace(/\s+/g, '_').slice(0, 25));
  if (atrib.voltagem !== 'INDISPONIVEL') parts.push(atrib.voltagem);
  if (atrib.potencia !== 'INDISPONIVEL') parts.push(atrib.potencia);
  if (atrib.diametro !== 'INDISPONIVEL') parts.push(atrib.diametro);
  if (atrib.amperagem !== 'INDISPONIVEL') parts.push(atrib.amperagem);

  return parts.join('-').toUpperCase();
}

export function executarMatchingEmCamadas(
  termoSolicitado: string,
  candidatoTitulo: string,
  candidatoSku?: string,
  itemOrig?: any
): ResultadoMatchingCamadas {
  const targetSku = (typeof itemOrig === 'object' ? (itemOrig.codigo_fornecedor || itemOrig.sku || itemOrig.codigoProduto || itemOrig.codigo || '') : '').trim();
  const reqSkuMatch = termoSolicitado.match(/\b(\d{5,8})\b/)?.[1] || targetSku;

  const solAtrib = extrairAtributosEstruturados(termoSolicitado, reqSkuMatch);
  const candAtrib = extrairAtributosEstruturados(candidatoTitulo, candidatoSku);

  const canonSol = gerarCanonicalId(solAtrib);
  const canonCand = gerarCanonicalId(candAtrib);

  const divergencias: string[] = [];

  // =========================================================================
  // CAMADA 1: Match Direto por SKU / Código de Referência Exato
  // =========================================================================
  if (reqSkuMatch && reqSkuMatch.length >= 5 && (candAtrib.sku === reqSkuMatch || candidatoTitulo.includes(reqSkuMatch))) {
    return {
      status: 'MATCH_EXATO',
      scoreConfianca: 1.0,
      camadaUtilizada: 1,
      canonicalIdSolicitado: canonSol,
      canonicalIdCandidato: canonCand,
      motivo: `🎯 Match Camada 1: SKU exato do fornecedor localizado (${reqSkuMatch})`,
      divergencias: [],
    };
  }

  // =========================================================================
  // VALIDAÇÕES ABSOLUTAS DE ATRIBUTOS CRÍTICOS (TRAVAS INVIOLÁVEIS)
  // =========================================================================

  // 1. REGRA ABSOLUTA DE VOLTAGEM: 127V vs 220V jamais podem casar!
  if (solAtrib.voltagem !== 'INDISPONIVEL' && candAtrib.voltagem !== 'INDISPONIVEL') {
    if (solAtrib.voltagem !== candAtrib.voltagem) {
      divergencias.push(`Voltagem incompatível: solicitado ${solAtrib.voltagem} vs candidato ${candAtrib.voltagem}`);
      return {
        status: 'AMBIGUO_REVISAO_MANUAL',
        scoreConfianca: 0.0,
        camadaUtilizada: 2,
        canonicalIdSolicitado: canonSol,
        canonicalIdCandidato: canonCand,
        motivo: `❌ Rejeitado na Camada 2: Voltagem incompatível (${solAtrib.voltagem} ≠ ${candAtrib.voltagem})`,
        divergencias,
      };
    }
  }

  // 2. REGRA ABSOLUTA DE AMPERAGEM: 20A vs 50A jamais podem casar!
  if (solAtrib.amperagem !== 'INDISPONIVEL' && candAtrib.amperagem !== 'INDISPONIVEL') {
    if (solAtrib.amperagem !== candAtrib.amperagem) {
      divergencias.push(`Amperagem incompatível: solicitada ${solAtrib.amperagem} vs candidato ${candAtrib.amperagem}`);
      return {
        status: 'AMBIGUO_REVISAO_MANUAL',
        scoreConfianca: 0.0,
        camadaUtilizada: 2,
        canonicalIdSolicitado: canonSol,
        canonicalIdCandidato: canonCand,
        motivo: `❌ Rejeitado na Camada 2: Amperagem incompatível (${solAtrib.amperagem} ≠ ${candAtrib.amperagem})`,
        divergencias,
      };
    }
  }

  // 3. REGRA DE MARCA: Se marca esperada for definida e o candidato for de outra marca conhecida
  if (solAtrib.marca !== 'INDISPONIVEL' && candAtrib.marca !== 'INDISPONIVEL') {
    if (solAtrib.marca !== candAtrib.marca) {
      divergencias.push(`Marca divergente: solicitada ${solAtrib.marca} vs candidato ${candAtrib.marca}`);
      return {
        status: 'AMBIGUO_REVISAO_MANUAL',
        scoreConfianca: 0.0,
        camadaUtilizada: 2,
        canonicalIdSolicitado: canonSol,
        canonicalIdCandidato: canonCand,
        motivo: `❌ Rejeitado na Camada 2: Marca divergente (${solAtrib.marca} ≠ ${candAtrib.marca})`,
        divergencias,
      };
    }
  }

  // 4. REGRA DE POTÊNCIA (Watts): Se solicitada potência e for diferente
  if (solAtrib.potencia !== 'INDISPONIVEL' && candAtrib.potencia !== 'INDISPONIVEL') {
    if (solAtrib.potencia !== candAtrib.potencia) {
      divergencias.push(`Potência divergente: solicitada ${solAtrib.potencia} vs candidato ${candAtrib.potencia}`);
    }
  }

  // =========================================================================
  // CAMADA 2: Match por Atributos Estruturados Independente da Ordem das Palavras
  // =========================================================================
  const marcaCompativel = solAtrib.marca === 'INDISPONIVEL' || candAtrib.marca === 'INDISPONIVEL' || solAtrib.marca === candAtrib.marca;
  const voltagemCompativel = solAtrib.voltagem === 'INDISPONIVEL' || candAtrib.voltagem === 'INDISPONIVEL' || solAtrib.voltagem === candAtrib.voltagem;

  if (marcaCompativel && voltagemCompativel) {
    const solTokens = tokenizarTextoNLP(termoSolicitado);
    const candTokens = tokenizarTextoNLP(candidatoTitulo);

    const tokensEmComum = solTokens.filter((t) => candTokens.some((ct) => ct.includes(t) || t.includes(ct)));
    const tokenRatio = solTokens.length > 0 ? tokensEmComum.length / solTokens.length : 0;
    const simModelo = stringSimilarity.compareTwoStrings(solAtrib.modelo, candAtrib.modelo);

    const solInCand = solTokens.every((st) => candTokens.some((ct) => ct.includes(st) || st.includes(ct)));

    if (solInCand || tokenRatio >= 0.7 || simModelo >= 0.55) {
      const conf = Math.max(0.9, 0.85 + (tokenRatio * 0.15));
      return {
        status: 'MATCH_EXATO',
        scoreConfianca: Math.min(1.0, conf),
        camadaUtilizada: 2,
        canonicalIdSolicitado: canonSol,
        canonicalIdCandidato: canonCand,
        motivo: `✅ Match Camada 2 (Atributos por Categoria Independente de Ordem): Categoria ${solAtrib.categoriaNome || 'Geral'}, Marca ${solAtrib.marca}, Voltagem ${solAtrib.voltagem}`,
        divergencias,
      };
    }
  }

  // =========================================================================
  // CAMADA 3: Fallback por Similaridade de Nome Normalizado
  // =========================================================================
  const normSol = normalizarTexto(termoSolicitado);
  const normCand = normalizarTexto(candidatoTitulo);
  const scoreSimilaridadeTextual = stringSimilarity.compareTwoStrings(normSol, normCand);

  if (divergencias.length === 0 && scoreSimilaridadeTextual >= 0.85) {
    return {
      status: 'MATCH_SIMILAR',
      scoreConfianca: scoreSimilaridadeTextual,
      camadaUtilizada: 3,
      canonicalIdSolicitado: canonSol,
      canonicalIdCandidato: canonCand,
      motivo: `⚠️ Match Camada 3 (Similaridade Textual Normalizada): Score ${(scoreSimilaridadeTextual * 100).toFixed(1)}%`,
      divergencias: [],
    };
  }

  // =========================================================================
  // REJEIÇÃO / AMBIGUIDADE (Confiança < 0.85 ou divergência de atributos)
  // =========================================================================
  return {
    status: 'AMBIGUO_REVISAO_MANUAL',
    scoreConfianca: scoreSimilaridadeTextual,
    camadaUtilizada: 0,
    canonicalIdSolicitado: canonSol,
    canonicalIdCandidato: canonCand,
    motivo: `⛔ Ambíguo / Baixa Confiança: Score ${(scoreSimilaridadeTextual * 100).toFixed(1)}% < 85% ou divergências encontradas`,
    divergencias: divergencias.length > 0 ? divergencias : ['Confiança textual abaixo do limiar mínimo de 85%'],
  };
}
