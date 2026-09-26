import { supabase } from '../db/client';
import { normalizarAtributosProduto, AtributosNormalizados } from './normalizer/attributeNormalizer';
import { normalizarPrecoPorUnidade } from './normalizer/unitPriceNormalizer';

export interface MatchingResultado {
  itemListaId?: string;
  fornecedorId: string;
  nomeSolicitado: string;
  produtoCanonicoId?: string;
  produtoEncontradoNome?: string;
  skuEncontrado?: string;
  matchTipo: 'exato' | 'similar' | 'pendente_revisao';
  confidence: number;
  nivelUtilizado: 1 | 2 | 3;
  motivoPendencia?: 'matching_ambiguo' | 'atributo_ausente_fornecedor' | 'sem_candidato';
  precoOriginal?: number;
  unidadeOriginal?: string;
  precoUnitarioBase?: number;
  unidadeBase?: string;
  detalhesMatch?: string;
  sugestoesCandidatos?: any[];
}

export interface MetricEstatisticasMatching {
  totalItens: number;
  vinculadosAutoExatos: number;
  vinculadosAutoAltaConfianca: number;
  percentualVinculadoAuto: number;
  pendentesBaixaConfianca: number;
  percentualPendentesBaixaConfianca: number;
  pendentesAtributoAusenteFornecedor: number;
  percentualPendentesAtributoAusente: number;
}

export class MatchingEngine {
  // Threshold de Alta Confiança para Vínculo Automático no Nível 2
  public static THRESHOLD_ALTA_CONFIANCA = 0.85;

  /**
   * Executa o matching de 3 Níveis com triagem inteligente e métricas refinadas
   */
  public static async executarMatchingItem(
    cotacaoId: string,
    itemListaId: string,
    fornecedorId: string,
    nomeSolicitado: string,
    categoriaSolicitada?: string,
    catalogoFornecedorLocal?: any[]
  ): Promise<MatchingResultado> {
    const atributosSolicitados = normalizarAtributosProduto(nomeSolicitado, categoriaSolicitada);

    // ==========================================
    // NÍVEL 1: SINÔNIMO EXATO (DEPARA)
    // ==========================================
    if (supabase) {
      try {
        const { data: sinonimo } = await supabase
          .from('sinonimos_por_fornecedor')
          .select('produto_canonico_id, produtos_canonicos(*)')
          .eq('fornecedor_id', fornecedorId)
          .eq('nome_bruto_fornecedor', nomeSolicitado.trim().toUpperCase())
          .maybeSingle();

        if (sinonimo && sinonimo.produto_canonico_id) {
          const canonico = sinonimo.produtos_canonicos as any;
          console.log(`🎯 [MATCHING NÍVEL 1 EXATO] De-para localizado: "${nomeSolicitado}" -> "${canonico?.nome_limpo}"`);
          return {
            itemListaId,
            fornecedorId,
            nomeSolicitado,
            produtoCanonicoId: sinonimo.produto_canonico_id,
            produtoEncontradoNome: canonico?.nome_limpo || nomeSolicitado,
            matchTipo: 'exato',
            confidence: 1.0,
            nivelUtilizado: 1,
            detalhesMatch: 'Match exato depara previamente aprovado',
          };
        }
      } catch (err) {
        console.warn('[MATCHING NÍVEL 1 WARN] Erro ao consultar sinonimos_por_fornecedor:', err);
      }
    }

    // ==========================================
    // NÍVEL 2: COMPATIBILIDADE DE ATRIBUTOS + SIMILARIDADE SEMÂNTICA
    // ==========================================
    const listaProdutosCat = catalogoFornecedorLocal || [];
    let candidatosAvaliados: { produto: any; score: number; motivos: string[]; atributoAusente: boolean }[] = [];

    for (const prod of listaProdutosCat) {
      const nomeProdStr = prod.nome_original || prod.nome || prod.sku;
      const attrProd: AtributosNormalizados = prod.atributos || normalizarAtributosProduto(nomeProdStr, prod.categoria_site);

      let score = 0;
      let maxPossibleWeight = 0.4; // Peso base da similaridade textual
      let motivos: string[] = [];
      let atributoAusente = false;

      // A) Similaridade Textual / Semântica (peso 40%)
      const simTextual = calcularSimilaridadeTexto(atributosSolicitados.nomeLimpo, attrProd.nomeLimpo);
      score += simTextual * 0.4;

      // B) Marca (peso 20%)
      if (atributosSolicitados.marca !== 'indisponível' || attrProd.marca !== 'indisponível') {
        maxPossibleWeight += 0.2;
        if (atributosSolicitados.marca !== 'indisponível' && attrProd.marca !== 'indisponível') {
          if (atributosSolicitados.marca.toUpperCase() === attrProd.marca.toUpperCase()) {
            score += 0.2;
            motivos.push('Marca compatível');
          } else {
            score -= 0.15;
            motivos.push(`Marca divergente (${attrProd.marca})`);
          }
        } else if (atributosSolicitados.marca !== 'indisponível' && attrProd.marca === 'indisponível') {
          atributoAusente = true;
          motivos.push('Marca ausente no catálogo do fornecedor');
        }
      }

      // C) Diâmetro / Bitola (peso 20%)
      if (atributosSolicitados.diametro !== 'indisponível' || attrProd.diametro !== 'indisponível') {
        maxPossibleWeight += 0.2;
        if (atributosSolicitados.diametro !== 'indisponível' && attrProd.diametro !== 'indisponível') {
          if (atributosSolicitados.diametro.toUpperCase() === attrProd.diametro.toUpperCase()) {
            score += 0.2;
            motivos.push('Diâmetro compatível');
          } else {
            score -= 0.3;
            motivos.push(`Diâmetro divergente (${attrProd.diametro})`);
          }
        } else if (atributosSolicitados.diametro !== 'indisponível' && attrProd.diametro === 'indisponível') {
          atributoAusente = true;
          motivos.push('Diâmetro ausente no catálogo do fornecedor');
        }
      }

      // D) Voltagem (peso 20%)
      if (atributosSolicitados.voltagem !== 'indisponível' || attrProd.voltagem !== 'indisponível') {
        maxPossibleWeight += 0.2;
        if (atributosSolicitados.voltagem !== 'indisponível' && attrProd.voltagem !== 'indisponível') {
          if (atributosSolicitados.voltagem.toUpperCase() === attrProd.voltagem.toUpperCase()) {
            score += 0.2;
            motivos.push('Voltagem compatível');
          } else {
            score -= 0.3;
            motivos.push(`Voltagem divergente (${attrProd.voltagem})`);
          }
        } else if (atributosSolicitados.voltagem !== 'indisponível' && attrProd.voltagem === 'indisponível') {
          atributoAusente = true;
          motivos.push('Voltagem ausente no catálogo do fornecedor');
        }
      }

      const finalScore = maxPossibleWeight > 0 ? score / maxPossibleWeight : 0;
      const boundedScore = Math.max(0, Math.min(1.0, Number(finalScore.toFixed(2))));
      candidatosAvaliados.push({
        produto: prod,
        score: boundedScore,
        motivos,
        atributoAusente,
      });
    }

    candidatosAvaliados.sort((a, b) => b.score - a.score);
    const melhorCandidato = candidatosAvaliados[0];

    // SE SCORE DA CANDIDATURA PASSAR DO THRESHOLD DE ALTA CONFIANÇA (>= 85%) -> VÍNCULO AUTOMÁTICO
    if (melhorCandidato && melhorCandidato.score >= this.THRESHOLD_ALTA_CONFIANCA) {
      const prod = melhorCandidato.produto;
      const precoNorm = normalizarPrecoPorUnidade(prod.preco || prod.preco_unitario || 0, prod.unidade_venda || prod.unidade, prod.nome_original);

      console.log(`⚡ [MATCHING NÍVEL 2 ALTA CONFIANÇA] Vinculado automaticamente (${(melhorCandidato.score * 100).toFixed(0)}%): "${nomeSolicitado}" -> "${prod.nome_original}"`);

      // Registrar no Log de Auditoria
      this.registrarLogAuditoriaAutoMatch(cotacaoId, fornecedorId, nomeSolicitado, prod.nome_original, melhorCandidato.score);

      return {
        itemListaId,
        fornecedorId,
        nomeSolicitado,
        produtoEncontradoNome: prod.nome_original,
        skuEncontrado: prod.sku,
        matchTipo: 'similar',
        confidence: melhorCandidato.score,
        nivelUtilizado: 2,
        precoOriginal: prod.preco,
        unidadeOriginal: prod.unidade_venda,
        precoUnitarioBase: precoNorm.precoUnitarioBase,
        unidadeBase: precoNorm.unidadeBase,
        detalhesMatch: `Matching automático Nível 2 - Alta Confiança (${melhorCandidato.motivos.join('; ')})`,
      };
    }

    // ==========================================
    // NÍVEL 3: TRIAGEM PARA FILA DE PENDÊNCIAS
    // ==========================================
    const motivoClassificado: 'matching_ambiguo' | 'atributo_ausente_fornecedor' | 'sem_candidato' =
      !melhorCandidato || melhorCandidato.score === 0
        ? 'sem_candidato'
        : melhorCandidato.atributoAusente
        ? 'atributo_ausente_fornecedor'
        : 'matching_ambiguo';

    console.warn(`⏳ [MATCHING NÍVEL 3 TRIAGEM] Pendência registrada (${motivoClassificado}): "${nomeSolicitado}" (Confiança: ${(melhorCandidato?.score || 0) * 100}%).`);

    const sugestoesTop3 = candidatosAvaliados.slice(0, 3).map((c) => ({
      sku: c.produto.sku,
      nome: c.produto.nome_original,
      preco: c.produto.preco,
      score: c.score,
      motivos: c.motivos.join('; '),
    }));

    if (supabase) {
      try {
        await supabase.from('itens_pendentes_revisao').insert([
          {
            cotacao_id: cotacaoId,
            item_lista_id: itemListaId,
            fornecedor_id: fornecedorId,
            nome_bruto: nomeSolicitado,
            categoria: categoriaSolicitada || 'geral',
            candidatos_json: sugestoesTop3,
            motivo_pendencia: motivoClassificado,
            status: 'pendente',
          },
        ]);
      } catch (errDb) {
        console.warn('[MATCHING NÍVEL 3 DB WARN] Falha ao registrar pendência:', errDb);
      }
    }

    return {
      itemListaId,
      fornecedorId,
      nomeSolicitado,
      matchTipo: 'pendente_revisao',
      confidence: melhorCandidato?.score || 0,
      nivelUtilizado: 3,
      motivoPendencia: motivoClassificado,
      detalhesMatch: `Enviado para revisão manual (${motivoClassificado}). Cotação prossegue sem travar.`,
      sugestoesCandidatos: sugestoesTop3,
    };
  }

  /**
   * Grava registro no Log de Auditoria para vínculos de Nível 2 Alta Confiança
   */
  private static async registrarLogAuditoriaAutoMatch(
    cotacaoId: string,
    fornecedorId: string,
    nomeOriginal: string,
    nomeEncontrado: string,
    confidence: number
  ) {
    if (!supabase) return;
    try {
      await supabase.from('historico_cotacoes').insert([
        {
          cotacao_id: cotacaoId,
          fornecedor_id: fornecedorId,
          tipo_evento: 'auto_match_nivel2_alta_confianca',
          detalhes_json: {
            nomeOriginal,
            nomeEncontrado,
            confidence: `${(confidence * 100).toFixed(0)}%`,
            timestamp: new Date().toISOString(),
          },
        },
      ]);
    } catch (e) {
      // Ignorar erros de log secundário
    }
  }

  /**
   * Calcula as métricas consolidadas exigidas pelo usuário
   */
  public static calcularEstatisticasMatching(resultados: MatchingResultado[]): MetricEstatisticasMatching {
    const total = resultados.length;
    if (total === 0) {
      return {
        totalItens: 0,
        vinculadosAutoExatos: 0,
        vinculadosAutoAltaConfianca: 0,
        percentualVinculadoAuto: 0,
        pendentesBaixaConfianca: 0,
        percentualPendentesBaixaConfianca: 0,
        pendentesAtributoAusenteFornecedor: 0,
        percentualPendentesAtributoAusente: 0,
      };
    }

    const exatos = resultados.filter((r) => r.nivelUtilizado === 1).length;
    const altaConfianca = resultados.filter((r) => r.nivelUtilizado === 2 && r.confidence >= this.THRESHOLD_ALTA_CONFIANCA).length;
    const totalAuto = exatos + altaConfianca;

    const pendentesAmbiguos = resultados.filter((r) => r.nivelUtilizado === 3 && r.motivoPendencia === 'matching_ambiguo').length;
    const pendentesAtributoAusente = resultados.filter((r) => r.nivelUtilizado === 3 && (r.motivoPendencia === 'atributo_ausente_fornecedor' || r.motivoPendencia === 'sem_candidato')).length;

    return {
      totalItens: total,
      vinculadosAutoExatos: exatos,
      vinculadosAutoAltaConfianca: altaConfianca,
      percentualVinculadoAuto: Number(((totalAuto / total) * 100).toFixed(1)),
      pendentesBaixaConfianca: pendentesAmbiguos,
      percentualPendentesBaixaConfianca: Number(((pendentesAmbiguos / total) * 100).toFixed(1)),
      pendentesAtributoAusenteFornecedor: pendentesAtributoAusente,
      percentualPendentesAtributoAusente: Number(((pendentesAtributoAusente / total) * 100).toFixed(1)),
    };
  }
}

function calcularSimilaridadeTexto(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  const words1 = new Set(text1.toUpperCase().split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(text2.toUpperCase().split(/\s+/).filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  words1.forEach((w) => {
    if (words2.has(w)) intersection++;
  });

  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}
