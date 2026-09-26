/**
 * Registry Declarativo de Schemas de Atributos por Categoria (Saracota)
 * 
 * Permite extrair atributos técnicos (marca, modelo, voltagem, potência, amperagem, bitola, cor, material)
 * de forma 100% independente da ordem em que os termos aparecem na frase.
 */

export type TipoAtributo = 'texto' | 'texto_livre' | 'enum' | 'numero_unidade';

export interface AttributeSpec {
  chave: string;
  rotulo: string;
  tipo: TipoAtributo;
  obrigatorioParaMatch?: boolean;
  dicionario?: string[];
  valoresEnum?: string[];
  regex?: RegExp;
  unidade?: string;
  mapaSinonimos?: Record<string, string>;
}

export interface CategorySchema {
  categoriaId: string;
  nomeExibicao: string;
  aliasesCategoria: string[];
  atributos: Record<string, AttributeSpec>;
}

export interface AtributosCategoriaExtrapolados {
  categoriaId: string;
  categoriaNome: string;
  raw: string;
  nomeLimpo: string;
  tokensRelevantes: string[];
  atributos: Record<string, string>; // e.g. { marca: 'LORENZETTI', voltagem: '220V', potencia: '6800W' }
}

/**
 * Normalização robusta de texto (sem acentos, minúsculas, remoção de conectores)
 */
export function normalizarTextoNLP(txt: string): string {
  if (!txt) return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s"/.,°-]/g, ' ') // mantém letras, números e pontuações técnicas
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenização e remoção de conectores irrelevantes
 */
export function tokenizarTextoNLP(txt: string): string[] {
  const norm = normalizarTextoNLP(txt);
  const stopWords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'com', 'para', 'em', 'por', 'sem', 'ou', 'e',
    'x', 'uni', 'un', 'pçs', 'pcs', 'cx', 'caixa', 'm', 'metro', 'kg', 'g', 'l',
    'ref', 'cod', 'codigo', 'sku', 'tipo'
  ]);

  return norm
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !stopWords.has(tok));
}

// ============================================================================
// DICIONÁRIOS GLOBAIS DE MARCAS E CORES
// ============================================================================
export const MARCAS_GLOBAIS = [
  'LORENZETTI', 'FAME', 'HYDRA', 'ZAGONEL', 'CARDAL', 'SINTEX',
  'TIGRE', 'FORTLEV', 'AMANCO', 'AM ANCO', 'KRONA', 'DECA', 'DOCOL', 'CORFIO',
  'SIL', 'PRYSMIAN', 'COBRECOM', 'NAMBEI', 'SPARTA', 'MTX', 'PERKON', 'BRASFORT',
  'VEDACIT', 'BIANCO', 'STAMP', 'PADO', 'TRAMONTINA', 'BOSCH', 'MAKITA', 'SKIL',
  'DEWALT', 'VONDER', 'IRWIN', 'STARRETT', 'GERDAU', 'CSN', 'ILUMI', 'WEG',
  'STECK', 'SCHNEIDER', 'SIEMENS', 'SOPRANO', 'ALUMBRA', 'MARGIRIUS', 'SULTRONIC',
  'COLORGIN', 'SUVECIL', 'SUVINIL', 'CORAL', 'LUKSCOLOR', 'SHERWIN', 'TEKBOND',
  'CIBRA', 'OTTO', 'BARONE', 'WR', 'PMR', 'NEGRINI'
];

export const CORES_GLOBAIS = [
  'BRANCA', 'BRANCO', 'CROMADA', 'CROMADO', 'PRETA', 'PRETO', 'CINZA',
  'AZUL', 'VERMELHO', 'VERMELHA', 'AMARELO', 'AMARELA', 'VERDE', 'MARROM',
  'TRANSPARENTE', 'CRISTAL', 'DOURADO', 'FOSCO', 'BRILHANTE'
];

// ============================================================================
// REGISTRY DECLARATIVO DE SCHEMAS POR CATEGORIA
// ============================================================================
export const CATEGORY_SCHEMAS: Record<string, CategorySchema> = {
  chuveiro: {
    categoriaId: 'chuveiro',
    nomeExibicao: 'Chuveiros e Duchas Elétricas',
    aliasesCategoria: ['chuveiro', 'chuveiros', 'ducha', 'duchas', 'duchao', 'chuveirinho'],
    atributos: {
      marca: {
        chave: 'marca',
        rotulo: 'Marca',
        tipo: 'texto',
        obrigatorioParaMatch: true,
        dicionario: ['LORENZETTI', 'FAME', 'HYDRA', 'ZAGONEL', 'CARDAL', 'SINTEX', 'WR', 'PMR']
      },
      modelo: {
        chave: 'modelo',
        rotulo: 'Modelo',
        tipo: 'texto_livre',
        obrigatorioParaMatch: true
      },
      voltagem: {
        chave: 'voltagem',
        rotulo: 'Voltagem',
        tipo: 'enum',
        obrigatorioParaMatch: true,
        valoresEnum: ['127V', '220V', 'BIVOLT'],
        unidade: 'V',
        regex: /\b(127|220|110)\s*V?\b/i,
        mapaSinonimos: { '110V': '127V', '110': '127V', '127': '127V', '220': '220V' }
      },
      potencia: {
        chave: 'potencia',
        rotulo: 'Potência',
        tipo: 'numero_unidade',
        obrigatorioParaMatch: false,
        unidade: 'W',
        regex: /\b(\d{3,5})\s*W\b/i
      },
      cor: {
        chave: 'cor',
        rotulo: 'Cor',
        tipo: 'texto',
        dicionario: ['BRANCA', 'BRANCO', 'CROMADA', 'CROMADO', 'PRETA', 'PRETO', 'CINZA']
      }
    }
  },

  alicate: {
    categoriaId: 'alicate',
    nomeExibicao: 'Alicates e Ferramentas Manuais',
    aliasesCategoria: ['alicate', 'alicates', 'alicate_universal', 'alicate_corte', 'alicate_bico', 'alicate_pressao'],
    atributos: {
      marca: {
        chave: 'marca',
        rotulo: 'Marca',
        tipo: 'texto',
        obrigatorioParaMatch: true,
        dicionario: ['SPARTA', 'MTX', 'TRAMONTINA', 'VONDER', 'IRWIN', 'BRASFORT', 'BOSCH', 'STARRETT']
      },
      tipo_alicate: {
        chave: 'tipo_alicate',
        rotulo: 'Tipo de Alicate',
        tipo: 'enum',
        valoresEnum: ['UNIVERSAL', 'CORTE', 'BICO', 'PRESSAO', 'DEVIADOR', 'PRENSADOR'],
        regex: /\b(UNIVERSAL|CORTE|BICO|PRESSAO|PRESSÃO|PRENSADOR)\b/i
      },
      tamanho_polegadas: {
        chave: 'tamanho_polegadas',
        rotulo: 'Tamanho em Polegadas',
        tipo: 'numero_unidade',
        unidade: '"',
        regex: /\b(\d{1,2})\s*(?:POL|POLEGADAS|")\b/i
      },
      isolamento: {
        chave: 'isolamento',
        rotulo: 'Isolamento Elétrico',
        tipo: 'enum',
        valoresEnum: ['1000V', 'ISOLADO', 'NORMAL'],
        regex: /\b(1000V|ISOLADO)\b/i
      }
    }
  },

  disjuntor: {
    categoriaId: 'disjuntor',
    nomeExibicao: 'Disjuntores e Proteção Elétrica',
    aliasesCategoria: ['disjuntor', 'disjuntores', 'minidisjuntor', 'dpn', 'dr', 'dps'],
    atributos: {
      marca: {
        chave: 'marca',
        rotulo: 'Marca',
        tipo: 'texto',
        obrigatorioParaMatch: true,
        dicionario: ['STECK', 'WEG', 'SCHNEIDER', 'SIEMENS', 'SOPRANO', 'ILUMI', 'ALUMBRA']
      },
      amperagem: {
        chave: 'amperagem',
        rotulo: 'Amperagem',
        tipo: 'numero_unidade',
        obrigatorioParaMatch: true,
        unidade: 'A',
        regex: /\b(\d{1,3})\s*A\b/i
      },
      num_polos: {
        chave: 'num_polos',
        rotulo: 'Número de Pólos',
        tipo: 'enum',
        obrigatorioParaMatch: true,
        valoresEnum: ['1P', '2P', '3P', 'MONOPOLAR', 'BIPOLAR', 'TRIPOLAR'],
        regex: /\b(1P|2P|3P|MONOPOLAR|BIPOLAR|TRIPOLAR)\b/i,
        mapaSinonimos: { '1P': 'MONOPOLAR', '2P': 'BIPOLAR', '3P': 'TRIPOLAR' }
      },
      curva: {
        chave: 'curva',
        rotulo: 'Curva de Disparo',
        tipo: 'enum',
        valoresEnum: ['CURVA B', 'CURVA C'],
        regex: /\b(CURVA\s*[BC]|[BC])\b/i
      }
    }
  },

  fio_cabo: {
    categoriaId: 'fio_cabo',
    nomeExibicao: 'Fios e Cabos Elétricos',
    aliasesCategoria: ['fio', 'fios', 'cabo', 'cabos', 'cabo_flexivel', 'fio_solido', 'cordal'],
    atributos: {
      marca: {
        chave: 'marca',
        rotulo: 'Marca',
        tipo: 'texto',
        obrigatorioParaMatch: true,
        dicionario: ['SIL', 'CORFIO', 'PRYSMIAN', 'COBRECOM', 'NAMBEI', 'INDUSFIO']
      },
      bitola: {
        chave: 'bitola',
        rotulo: 'Bitola (Seção)',
        tipo: 'numero_unidade',
        obrigatorioParaMatch: true,
        unidade: 'MM²',
        regex: /\b(\d+(?:[.,]\d+)?)\s*(?:MM²|MM2|MM)\b/i
      },
      comprimento: {
        chave: 'comprimento',
        rotulo: 'Comprimento Rolo',
        tipo: 'numero_unidade',
        unidade: 'M',
        regex: /\b(\d{2,4})\s*(?:M|MTS|METROS)\b/i
      },
      voltagem_isolamento: {
        chave: 'voltagem_isolamento',
        rotulo: 'Voltagem de Isolamento',
        tipo: 'enum',
        valoresEnum: ['750V', '1KV'],
        regex: /\b(750V|1KV)\b/i
      },
      cor: {
        chave: 'cor',
        rotulo: 'Cor da Capa',
        tipo: 'texto',
        dicionario: ['AZUL', 'VERMELHO', 'AMARELO', 'VERDE', 'PRETO', 'BRANCO', 'CINZA']
      }
    }
  },

  tinta: {
    categoriaId: 'tinta',
    nomeExibicao: 'Tintas e Pintura',
    aliasesCategoria: ['tinta', 'tintas', 'esmalte', 'acrilica', 'latex', 'selador', 'verniz', 'spray'],
    atributos: {
      marca: {
        chave: 'marca',
        rotulo: 'Marca',
        tipo: 'texto',
        obrigatorioParaMatch: true,
        dicionario: ['COLORGIN', 'SUVINIL', 'CORAL', 'LUKSCOLOR', 'SHERWIN', 'TEKBOND', 'CIBRA']
      },
      volume: {
        chave: 'volume',
        rotulo: 'Volume / Embalagem',
        tipo: 'numero_unidade',
        unidade: 'L',
        regex: /\b(\d+(?:[.,]\d+)?)\s*(?:L|LITROS|ML)\b/i
      },
      acabamento: {
        chave: 'acabamento',
        rotulo: 'Acabamento',
        tipo: 'enum',
        valoresEnum: ['FOSCO', 'SEMIBRILHO', 'BRILHANTE', 'Satinado'],
        regex: /\b(FOSCO|SEMIBRILHO|BRILHANTE)\b/i
      },
      cor: {
        chave: 'cor',
        rotulo: 'Cor',
        tipo: 'texto',
        dicionario: CORES_GLOBAIS
      }
    }
  },

  geral: {
    categoriaId: 'geral',
    nomeExibicao: 'Materiais Gerais de Construção',
    aliasesCategoria: [],
    atributos: {
      marca: {
        chave: 'marca',
        rotulo: 'Marca',
        tipo: 'texto',
        dicionario: MARCAS_GLOBAIS
      },
      voltagem: {
        chave: 'voltagem',
        rotulo: 'Voltagem',
        tipo: 'enum',
        valoresEnum: ['127V', '220V', 'BIVOLT'],
        unidade: 'V',
        regex: /\b(127|220|110)\s*V?\b/i,
        mapaSinonimos: { '110V': '127V', '110': '127V', '127': '127V', '220': '220V' }
      },
      potencia: {
        chave: 'potencia',
        rotulo: 'Potência',
        tipo: 'numero_unidade',
        unidade: 'W',
        regex: /\b(\d{3,5})\s*W\b/i
      },
      amperagem: {
        chave: 'amperagem',
        rotulo: 'Amperagem',
        tipo: 'numero_unidade',
        unidade: 'A',
        regex: /\b(\d{1,3})\s*A\b/i
      },
      bitola: {
        chave: 'bitola',
        rotulo: 'Bitola / Medida',
        tipo: 'numero_unidade',
        regex: /\b(\d+(?:[.,]\d+)?\s*(?:MM²|MM|POL|")|\d+\/\d+)\b/i
      },
      cor: {
        chave: 'cor',
        rotulo: 'Cor',
        tipo: 'texto',
        dicionario: CORES_GLOBAIS
      }
    }
  }
};

/**
 * 🔍 Detector Inteligente de Categoria por Keywords e Aliases
 */
export function detectarCategoriaProduto(rawText: string): CategorySchema {
  const norm = normalizarTextoNLP(rawText);
  const tokens = norm.split(/\s+/);

  for (const [catId, schema] of Object.entries(CATEGORY_SCHEMAS)) {
    if (catId === 'geral') continue;
    for (const alias of schema.aliasesCategoria) {
      const aliasNorm = normalizarTextoNLP(alias);
      if (norm.includes(aliasNorm) || tokens.includes(aliasNorm)) {
        return schema;
      }
    }
  }

  return CATEGORY_SCHEMAS.geral;
}

/**
 * ⚡ Extrator de Atributos por Categoria (100% Independente da Ordem das Palavras)
 */
export function extrairAtributosPorCategoria(
  rawText: string,
  categoriaHint?: string
): AtributosCategoriaExtrapolados {
  const schema = (categoriaHint && CATEGORY_SCHEMAS[categoriaHint])
    ? CATEGORY_SCHEMAS[categoriaHint]
    : detectarCategoriaProduto(rawText);

  const norm = normalizarTextoNLP(rawText);
  const tokens = tokenizarTextoNLP(rawText);
  const atributosExtraidos: Record<string, string> = {};

  let textWorking = norm;

  for (const [attrKey, spec] of Object.entries(schema.atributos)) {
    let valorExtraido = 'INDISPONIVEL';

    // 1. Extração por Regex
    if (spec.regex) {
      const match = textWorking.match(spec.regex);
      if (match) {
        let val = (match[1] || match[0]).toUpperCase().replace(/\s+/g, '');
        if (spec.unidade && !val.includes(spec.unidade)) {
          val = `${val}${spec.unidade}`;
        }
        if (spec.mapaSinonimos && spec.mapaSinonimos[val]) {
          val = spec.mapaSinonimos[val];
        }
        valorExtraido = val;
        textWorking = textWorking.replace(match[0], ' ');
      }
    }

    // 2. Extração por Dicionário / Enum de Palavras Conhecidas (Independente de Posição)
    if (valorExtraido === 'INDISPONIVEL' && spec.dicionario) {
      for (const itemDic of spec.dicionario) {
        const itemNorm = normalizarTextoNLP(itemDic);
        const regexDic = new RegExp(`\\b${itemNorm}\\b`, 'i');
        if (regexDic.test(textWorking)) {
          valorExtraido = itemDic.toUpperCase();
          textWorking = textWorking.replace(regexDic, ' ');
          break;
        }
      }
    }

    // 3. Fallback Enum
    if (valorExtraido === 'INDISPONIVEL' && spec.valoresEnum) {
      for (const itemEnum of spec.valoresEnum) {
        const enumNorm = normalizarTextoNLP(itemEnum);
        if (textWorking.includes(enumNorm)) {
          valorExtraido = itemEnum.toUpperCase();
          textWorking = textWorking.replace(enumNorm, ' ');
          break;
        }
      }
    }

    atributosExtraidos[attrKey] = valorExtraido;
  }

  // Modelo = texto restante limpo de SKU numérico, marcas e especificações
  const modeloLimpo = textWorking
    .replace(/\b\d{5,8}\b/g, '')
    .replace(/\b\d+T\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  atributosExtraidos['modelo'] = modeloLimpo || norm.toUpperCase();

  const nomeLimpo = tokens.join(' ').toUpperCase();

  return {
    categoriaId: schema.categoriaId,
    categoriaNome: schema.nomeExibicao,
    raw: rawText,
    nomeLimpo,
    tokensRelevantes: tokens,
    atributos: atributosExtraidos
  };
}
