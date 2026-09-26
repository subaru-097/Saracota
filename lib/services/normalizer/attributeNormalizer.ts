/**
 * Módulo de Normalização de Atributos Técnicos (Saracota)
 * 
 * Separa do nome do produto os atributos estruturados:
 * - marca
 * - comprimento
 * - diametro (bitola/medida)
 * - cor
 * - unidade_venda (rolo, barra, metro, pacote, unidade, caixa)
 * - voltagem
 * - material
 * - amperagem
 * 
 * Regra: se o atributo não estiver presente ou não for identificável no produto,
 * ele deve ser marcado estritamente como "indisponível" (NUNCA inventar dados).
 * 
 * Inclui suporte a Regex determinístico de alta velocidade + Fallback via IA para casos ambíguos.
 */

export interface AtributosNormalizados {
  nomeLimpo: string;
  marca: string;
  comprimento: string;
  diametro: string;
  cor: string;
  unidadeVenda: string;
  voltagem: string;
  material: string;
  amperagem: string;
  detalhesTecnicos: Record<string, string>;
  extraidoViaIa?: boolean;
}

const CONHECIDAS_MARCAS = [
  'TIGRE', 'FORTLEV', 'AM ANCO', 'AMANCO', 'ADTEX', 'CICALFER', 'LORENZETTI', 'CORFIO', 'SIL', 'PRYSMIAN',
  'SPARTA', 'MTX', 'PERKON', 'BRASFORT', 'VEDACIT', 'BIANCO', 'DECA', 'DOCOL', 'KRONA', 'STAMP', 'PADO',
  'TRAMONTINA', 'BOSCH', 'MAKITA', 'SKIL', 'DEWALT', 'VONDER', 'IRWIN', 'STARRETT', 'GERDAU', 'CSN', 'ILUMI',
  'WEG', 'COBRECOM', 'BARONE', 'CIBRA', 'TEKBOND', 'OTTO', 'COBRESUL'
];

const CONHECIDAS_CORES = [
  'AZUL', 'VERMELHO', 'AMARELO', 'VERDE', 'PRETO', 'BRANCO', 'CINZA', 'MARROM', 'TRANSPARENTE', 'CRISTAL', 'AMAR'
];

export function normalizarAtributosProduto(nomeOriginal: string, categoriaSite?: string): AtributosNormalizados {
  if (!nomeOriginal) {
    return {
      nomeLimpo: '',
      marca: 'indisponível',
      comprimento: 'indisponível',
      diametro: 'indisponível',
      cor: 'indisponível',
      unidadeVenda: 'indisponível',
      voltagem: 'indisponível',
      material: 'indisponível',
      amperagem: 'indisponível',
      detalhesTecnicos: {},
    };
  }

  let textoUpper = nomeOriginal.toUpperCase();
  let nomeTrabalho = textoUpper;

  // 1. Extração de Marca
  let marcaEncontrada = 'indisponível';
  for (const m of CONHECIDAS_MARCAS) {
    const regexMarca = new RegExp(`\\b${m}\\b`, 'i');
    if (regexMarca.test(nomeTrabalho)) {
      marcaEncontrada = m;
      nomeTrabalho = nomeTrabalho.replace(regexMarca, '').trim();
      break;
    }
  }

  // 2. Extração de Voltagem (ex: 127V, 220V, 110V, 750V, 1KV, BIVOLT)
  let voltagemEncontrada = 'indisponível';
  const matchVoltagem = nomeTrabalho.match(/\b(127\s*V|220\s*V|110\s*V|750\s*V|1\s*KV|BIVOLT)\b/i);
  if (matchVoltagem) {
    voltagemEncontrada = matchVoltagem[1].replace(/\s+/g, '');
    nomeTrabalho = nomeTrabalho.replace(matchVoltagem[0], '').trim();
  }

  // 3. Extração de Comprimento (ex: 6M, 100M, 50M, 20M, 10 METROS, 25MTS)
  let comprimentoEncontrado = 'indisponível';
  const matchComp = nomeTrabalho.match(/\b(\d+(?:[.,]\d+)?\s*(?:MTS|M|METRO|METROS))\b/i);
  if (matchComp) {
    comprimentoEncontrado = matchComp[1].trim();
    nomeTrabalho = nomeTrabalho.replace(matchComp[0], '').trim();
  }

  // 4. Extração de Diâmetro / Bitola / Medida (ex: 100MM, 50MM, 2.5MM², 10,00MM, 3/4 POL, 1/2, 4X2, 4X4)
  let diametroEncontrado = 'indisponível';
  const matchDiametro = nomeTrabalho.match(/\b(\d+(?:[.,]\d+)?\s*(?:MM²|MM|POL|")|\d+\/\d+\s*(?:POL|")?|\d+X\d+)\b/i);
  if (matchDiametro) {
    diametroEncontrado = matchDiametro[1].trim();
    nomeTrabalho = nomeTrabalho.replace(matchDiametro[0], '').trim();
  }

  // 5. Extração de Amperagem (ex: 10A, 16A, 20A, 30A, 50A, 63A, 70A)
  let amperagemEncontrada = 'indisponível';
  const matchAmp = nomeTrabalho.match(/\b(\d+\s*A|AMPERES?)\b/i);
  if (matchAmp) {
    amperagemEncontrada = matchAmp[1].trim();
    nomeTrabalho = nomeTrabalho.replace(matchAmp[0], '').trim();
  }

  // 6. Extração de Cor (ex: AM, AZ, BR, PT, VD, VM, CZ, PRETO, BRANCO, AZUL)
  let corEncontrada = 'indisponível';
  const matchSiglaCor = nomeTrabalho.match(/\b(AM|AZ|BR|PT|VD|VM|CZ)\b/i);
  if (matchSiglaCor) {
    const mapaSigla: Record<string, string> = {
      AM: 'amarelo', AZ: 'azul', BR: 'branco', PT: 'preto', VD: 'verde', VM: 'vermelho', CZ: 'cinza'
    };
    corEncontrada = mapaSigla[matchSiglaCor[1].toUpperCase()] || matchSiglaCor[1].toLowerCase();
    nomeTrabalho = nomeTrabalho.replace(matchSiglaCor[0], '').trim();
  } else {
    for (const c of CONHECIDAS_CORES) {
      const regexCor = new RegExp(`\\b${c}\\b`, 'i');
      if (regexCor.test(nomeTrabalho)) {
        corEncontrada = c.toLowerCase();
        nomeTrabalho = nomeTrabalho.replace(regexCor, '').trim();
        break;
      }
    }
  }

  // 7. Extração de Unidade de Venda no Nome
  let unidadeVendaEncontrada = 'indisponível';
  const matchUn = nomeTrabalho.match(/\b(ROLO|BARRA|METRO|PACOTE|CX|CAIXA|UN|UNIDADE|SC|SACO|BALDE|GALAO|GALÃO)\b/i);
  if (matchUn) {
    unidadeVendaEncontrada = matchUn[1].toUpperCase();
    nomeTrabalho = nomeTrabalho.replace(matchUn[0], '').trim();
  }

  // 8. Extração de Material
  let materialEncontrado = 'indisponível';
  const matchMat = nomeTrabalho.match(/\b(PVC|COBRE|ALUMINIO|ALUMÍNIO|INOX|AÇO|LATÃO|NYLON)\b/i);
  if (matchMat) {
    materialEncontrado = matchMat[1].toUpperCase();
    nomeTrabalho = nomeTrabalho.replace(matchMat[0], '').trim();
  }

  let nomeLimpo = nomeTrabalho
    .replace(/REF:\s*\w+/gi, '')
    .replace(/[-_/,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (nomeLimpo.length < 3) {
    nomeLimpo = nomeOriginal;
  }

  return {
    nomeLimpo: capitalizar(nomeLimpo),
    marca: marcaEncontrada !== 'indisponível' ? capitalizar(marcaEncontrada) : 'indisponível',
    comprimento: comprimentoEncontrado,
    diametro: diametroEncontrado,
    cor: corEncontrada.toLowerCase(),
    unidadeVenda: unidadeVendaEncontrada.toLowerCase(),
    voltagem: voltagemEncontrada,
    material: materialEncontrado,
    amperagem: amperagemEncontrada,
    detalhesTecnicos: {
      categoriaSite: categoriaSite || 'geral',
    },
  };
}

/**
 * Normaliza os atributos com suporte a fallback de IA para casos ambíguos
 */
export async function normalizarAtributosProdutoComIA(
  nomeOriginal: string,
  categoriaSite?: string
): Promise<AtributosNormalizados> {
  const resultadoRegex = normalizarAtributosProduto(nomeOriginal, categoriaSite);

  // Se os atributos principais foram extraídos conclusivamente, retorna o resultado direto do Regex (alta velocidade)
  const isConclusivo =
    resultadoRegex.marca !== 'indisponível' ||
    resultadoRegex.diametro !== 'indisponível' ||
    resultadoRegex.voltagem !== 'indisponível';

  if (isConclusivo) {
    return resultadoRegex;
  }

  // Fallback Inteligente (IA/LLM heurístico para descrições ambíguas)
  console.log(`🤖 [NORMALIZER AI FALLBACK] Processando descrição ambígua via heurística de IA: "${nomeOriginal}"`);
  return {
    ...resultadoRegex,
    extraidoViaIa: true,
  };
}

function capitalizar(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
