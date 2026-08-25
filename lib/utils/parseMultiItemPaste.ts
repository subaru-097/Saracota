export interface ParsedPastedItem {
  id: string;
  rawLine: string;
  quantidade: number;
  nomeProduto: string;
}

/**
 * Mapeamento de palavras numéricas em português para suporte a quantidades escritas por extenso
 */
const NUMEROS_POR_EXTENSO: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  quinze: 15,
  vinte: 20,
  trinta: 30,
  cinquenta: 50,
  cem: 100,
};

/**
 * Função utilitária para verificar se um texto colado é multilinha/multi-item
 */
export function isMultiLinePaste(text: string): boolean {
  if (!text) return false;

  // Verifica quebras de linha (\n ou \r)
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) return true;

  // Verifica delimitadores de lista (ex: ponto e vírgula com múltiplos itens "item1; item2; item3")
  if (text.includes(';') && text.split(';').map((l) => l.trim()).filter(Boolean).length >= 2) {
    return true;
  }

  // Verifica listas numeradas em linha única (ex: "1. item A 2. item B")
  const regexNumeradoInline = /(?:^|\s)\d+[\.\)]\s+[^\d]+/g;
  const matches = text.match(regexNumeradoInline);
  if (matches && matches.length >= 2) {
    return true;
  }

  return false;
}

/**
 * Extrai quantidade e nome limpo de uma única linha de texto
 */
export function parseSingleItemLine(rawLine: string, index: number = 0): ParsedPastedItem {
  const lineId = `paste-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`;
  let cleanLine = rawLine.trim();

  // 1. Remover marcadores de lista no início da linha (ex: "1.", "2)", "•", "-", "*")
  cleanLine = cleanLine.replace(/^(?:\d+[\.\)]|[\u2022\u25E6\u2023\u2043\u2212\-\*])\s*/, '').trim();

  if (!cleanLine) {
    return {
      id: lineId,
      rawLine,
      quantidade: 1,
      nomeProduto: 'Item sem descrição',
    };
  }

  let quantidade = 1;
  let nomeProduto = cleanLine;

  // 2. Padrão A: Quantidade no início da linha
  // Exemplos: "3 chuveiros", "5x cimento", "10 - vergalhão", "2 sacos de cal", "6 latas de spray"
  const regexInicioQtd = /^(?:(\d+)|(um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez|quinze|vinte|trinta|cinquenta|cem))\s*(?:x|X|unidades?|un|pçs?|pçs?\.)?\s*[\-\–\:]?\s*(.+)$/i;
  const matchInicio = cleanLine.match(regexInicioQtd);

  if (matchInicio) {
    const numDigit = matchInicio[1];
    const numExtenso = matchInicio[2]?.toLowerCase();
    const restoNome = matchInicio[3]?.trim();

    if (numDigit) {
      quantidade = parseInt(numDigit, 10);
    } else if (numExtenso && NUMEROS_POR_EXTENSO[numExtenso]) {
      quantidade = NUMEROS_POR_EXTENSO[numExtenso];
    }

    if (restoNome) {
      nomeProduto = restoNome;
    }
  } else {
    // 3. Padrão B: Quantidade no final da linha
    // Exemplos: "Vergalhão 8mm - 10 unidades", "Sifão sanfonado - 4 pçs", "Argamassa AC-III 6x", "Tubo PVC 100mm 5 varas"
    const regexFimQtd = /^(.+?)\s*[\-\–\:]?\s*(\d+)\s*(?:x|X|unidades?|un|pçs?|pçs?\.|sacos?|latas?|metros?|varas?|caixas?|barras?)$/i;
    const matchFim = cleanLine.match(regexFimQtd);

    if (matchFim) {
      const parteNome = matchFim[1]?.trim();
      const numFim = matchFim[2];

      if (parteNome && numFim && parteNome.length > 2) {
        quantidade = parseInt(numFim, 10);
        nomeProduto = parteNome;
      }
    }
  }

  // 4. Sanitização final do nome do produto
  nomeProduto = nomeProduto.replace(/^[\-\–\:\,\.\s]+|[\-\–\:\,\.\s]+$/g, '').trim();

  if (!nomeProduto) {
    nomeProduto = cleanLine;
  }

  nomeProduto = nomeProduto.charAt(0).toUpperCase() + nomeProduto.slice(1);

  return {
    id: lineId,
    rawLine,
    quantidade: Math.max(1, quantidade),
    nomeProduto,
  };
}

/**
 * Parser principal: recebe o texto bruto colado pelo usuário e retorna uma lista de itens estruturados
 */
export function parseMultiItemPaste(rawText: string): ParsedPastedItem[] {
  if (!rawText) return [];

  let rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (rawLines.length === 1 && rawText.includes(';')) {
    rawLines = rawText.split(';').map((l) => l.trim()).filter(Boolean);
  }

  if (rawLines.length === 1) {
    const splitNumerado = rawText.split(/(?=(?:^|\s)\d+[\.\)]\s+)/).map((l) => l.trim()).filter(Boolean);
    if (splitNumerado.length >= 2) {
      rawLines = splitNumerado;
    }
  }

  const parsedItems: ParsedPastedItem[] = [];
  rawLines.forEach((line, idx) => {
    if (!line) return;
    const parsed = parseSingleItemLine(line, idx);
    if (parsed.nomeProduto) {
      parsedItems.push(parsed);
    }
  });

  return parsedItems;
}
