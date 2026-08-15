import { processarMatchingTecnico, calcularFuzzySimilarity, converterUnidade } from '../lib/services/matching';
import { Produto } from '../types';

const PRODUTOS_TESTE: Produto[] = [
  {
    id: 'prod-test-1',
    nome: 'Cabo Flexível SIL 750V 2,5mm² Azul',
    categoria: 'eletrica',
    ncm: '8544.49.00',
    sku: 'SIL-CAB-25-AZ',
    atributos: { bitola: '2.5mm²', tensao: '750V', cor: 'Azul' },
    unidadesDisponiveis: ['Metro', 'Rolo 100m'],
    fatorConversaoMetro: 100,
    precoMedioReferencia: 2.85,
    unidadeBase: 'metros',
  },
];

/**
 * Suíte de Testes Unitários para o Motor de Matching Técnico e Fuzzy Search
 * (Conforme diretrizes de sara-matching-produtos)
 */
export function testarMotorMatching() {
  const resultados: { nome: string; passou: boolean; mensagem: string }[] = [];

  // Teste 1: Fuzzy Similarity String Match
  try {
    const similarity = calcularFuzzySimilarity('cabo 2.5mm sil azul', 'Cabo Flexível SIL 750V 2,5mm² Azul');
    const passou = similarity >= 75;
    resultados.push({
      nome: 'Fuzzy Similarity Search (Cabo 2.5mm)',
      passou,
      mensagem: `Score de similaridade: ${similarity}%`,
    });
  } catch (e: any) {
    resultados.push({ nome: 'Fuzzy Similarity Search', passou: false, mensagem: e.message });
  }

  // Teste 2: Matching Técnico Estrito por Bitola & Tensão
  try {
    const res = processarMatchingTecnico('cabo 2.5mm', { bitola: '2.5mm²', tensao: '750V' }, PRODUTOS_TESTE);
    const topMatch = res[0];
    const passou = topMatch && topMatch.confidenceScorePercent >= 85 && topMatch.matchingStatus === 'exato';
    resultados.push({
      nome: 'Matching Técnico Estrito (Bitola 2.5mm² + Tensão 750V)',
      passou,
      mensagem: `Match encontrado: ${topMatch?.produto.nome} (${topMatch?.confidenceScorePercent}% de confiança)`,
    });
  } catch (e: any) {
    resultados.push({ nome: 'Matching Técnico Estrito', passou: false, mensagem: e.message });
  }

  // Teste 3: Conversão de Unidades (Rolos 100m para Metros)
  try {
    const conv = converterUnidade(5, 'rolo 100m', 'metro', 100);
    const passou = conv.quantidadeConvertida === 500 && conv.fator === 100;
    resultados.push({
      nome: 'Conversão de Unidades Industriais (5 Rolos 100m -> 500m)',
      passou,
      mensagem: `Convertido: ${conv.quantidadeConvertida} metros (Fator: ${conv.fator})`,
    });
  } catch (e: any) {
    resultados.push({ nome: 'Conversão de Unidades', passou: false, mensagem: e.message });
  }

  return resultados;
}
