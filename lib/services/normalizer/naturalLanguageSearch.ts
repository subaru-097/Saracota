/**
 * Parser e Motor de Busca em Linguagem Natural (Saracota)
 * 
 * Converte comandos livres do usuário (ex: "chuveiro Lorenzetti 220", "fio 2.5mm 100m sil azul")
 * em pesquisas estruturadas por categoria e atributos técnicos entre fornecedores B2B.
 */

import {
  detectarCategoriaProduto,
  extrairAtributosPorCategoria,
  normalizarTextoNLP,
  tokenizarTextoNLP,
  AtributosCategoriaExtrapolados,
  CategorySchema
} from './categorySchemaRegistry';

export interface ParsedNaturalLanguageQuery {
  rawQuery: string;
  queryNorm: string;
  categoriaIdentificada: CategorySchema;
  atributosFiltro: Record<string, string>; // ex: { marca: 'LORENZETTI', voltagem: '220V' }
  keywords: string[];
  descricaoInterpreted: string;
}

export interface ResultadoBuscaLinguagemNatural {
  produto: any;
  scoreConfianca: number; // 0.0 a 1.0
  matchCategoria: boolean;
  atributosCoincidentes: string[];
  divergencias: string[];
  motivo: string;
}

/**
 * 🗣️ Interpreta comando livre em linguagem natural e gera filtros estruturados
 */
export function interpretarComandoLinguagemNatural(rawQuery: string): ParsedNaturalLanguageQuery {
  if (!rawQuery || !rawQuery.trim()) {
    const defaultSchema = detectarCategoriaProduto('');
    return {
      rawQuery: '',
      queryNorm: '',
      categoriaIdentificada: defaultSchema,
      atributosFiltro: {},
      keywords: [],
      descricaoInterpreted: 'Consulta vazia'
    };
  }

  const queryNorm = normalizarTextoNLP(rawQuery);
  const keywords = tokenizarTextoNLP(rawQuery);
  const categoriaSchema = detectarCategoriaProduto(rawQuery);
  const extrap = extrairAtributosPorCategoria(rawQuery, categoriaSchema.categoriaId);

  const atributosFiltro: Record<string, string> = {};
  const resumoPartes: string[] = [`Categoria: ${categoriaSchema.nomeExibicao}`];

  for (const [key, val] of Object.entries(extrap.atributos)) {
    if (val && val !== 'INDISPONIVEL' && key !== 'modelo') {
      atributosFiltro[key] = val;
      resumoPartes.push(`${key.toUpperCase()}: ${val}`);
    }
  }

  return {
    rawQuery,
    queryNorm,
    categoriaIdentificada: categoriaSchema,
    atributosFiltro,
    keywords,
    descricaoInterpreted: resumoPartes.join(' | ')
  };
}

/**
 * 🔍 Executa a busca em linguagem natural filtrando e ranqueando produtos de catálogo
 */
export function buscarCatalogosPorLinguagemNatural(
  rawQuery: string,
  produtosCatalogo: any[]
): ResultadoBuscaLinguagemNatural[] {
  if (!produtosCatalogo || produtosCatalogo.length === 0) return [];

  const parsedQuery = interpretarComandoLinguagemNatural(rawQuery);
  const queryTokens = parsedQuery.keywords;
  const targetCategory = parsedQuery.categoriaIdentificada.categoriaId;

  const resultados: ResultadoBuscaLinguagemNatural[] = [];

  for (const prod of produtosCatalogo) {
    const rawProdText = prod.nome_produto || prod.titulo || prod.nome || prod.material || '';
    const candExtrap = extrairAtributosPorCategoria(rawProdText, targetCategory);

    const divergencias: string[] = [];
    const coincidentes: string[] = [];

    // 1. TRAVA ABSOLUTA DE SEGURANÇA: Voltagem e Amperagem
    const reqVoltagem = parsedQuery.atributosFiltro['voltagem'];
    const candVoltagem = candExtrap.atributos['voltagem'];
    if (reqVoltagem && candVoltagem && candVoltagem !== 'INDISPONIVEL' && reqVoltagem !== candVoltagem) {
      divergencias.push(`Voltagem divergente (${reqVoltagem} ≠ ${candVoltagem})`);
      resultados.push({
        produto: prod,
        scoreConfianca: 0.0,
        matchCategoria: false,
        atributosCoincidentes: [],
        divergencias,
        motivo: `❌ Rejeitado por trava de segurança de voltagem (${reqVoltagem} ≠ ${candVoltagem})`
      });
      continue;
    }

    const reqAmp = parsedQuery.atributosFiltro['amperagem'];
    const candAmp = candExtrap.atributos['amperagem'];
    if (reqAmp && candAmp && candAmp !== 'INDISPONIVEL' && reqAmp !== candAmp) {
      divergencias.push(`Amperagem divergente (${reqAmp} ≠ ${candAmp})`);
      resultados.push({
        produto: prod,
        scoreConfianca: 0.0,
        matchCategoria: false,
        atributosCoincidentes: [],
        divergencias,
        motivo: `❌ Rejeitado por trava de segurança de amperagem (${reqAmp} ≠ ${candAmp})`
      });
      continue;
    }

    // 2. Pontuação por Atributos Coincidentes
    let totalFiltros = 0;
    let acertosFiltros = 0;

    for (const [attrKey, reqVal] of Object.entries(parsedQuery.atributosFiltro)) {
      totalFiltros++;
      const candVal = candExtrap.atributos[attrKey];
      if (candVal && candVal.toUpperCase() === reqVal.toUpperCase()) {
        acertosFiltros++;
        coincidentes.push(`${attrKey.toUpperCase()}=${reqVal}`);
      } else if (candVal && candVal !== 'INDISPONIVEL') {
        divergencias.push(`${attrKey.toUpperCase()} (${reqVal} ≠ ${candVal})`);
      }
    }

    // 3. Pontuação de Palavras-Chave (Keyword Token Ratio)
    const candTokens = candExtrap.tokensRelevantes;
    const matchesTokens = queryTokens.filter((qTok) =>
      candTokens.some((cTok) => cTok.includes(qTok) || qTok.includes(cTok))
    );

    const tokenScore = queryTokens.length > 0 ? matchesTokens.length / queryTokens.length : 0;
    const attrScore = totalFiltros > 0 ? acertosFiltros / totalFiltros : 1.0;

    // Score Final Combinado: 60% Atributos Estruturados + 40% Palavras-Chave
    const finalScore = totalFiltros > 0 ? (attrScore * 0.6 + tokenScore * 0.4) : tokenScore;

    const isMatchCat = candExtrap.categoriaId === targetCategory || targetCategory === 'geral';

    if (finalScore >= 0.4) {
      resultados.push({
        produto: prod,
        scoreConfianca: Math.round(finalScore * 100) / 100,
        matchCategoria: isMatchCat,
        atributosCoincidentes: coincidentes,
        divergencias,
        motivo: `✅ Match Linguagem Natural (${coincidentes.join(', ') || 'Keywords Match'})`
      });
    }
  }

  // Ordenar da maior confiança para a menor
  resultados.sort((a, b) => b.scoreConfianca - a.scoreConfianca);
  return resultados;
}
