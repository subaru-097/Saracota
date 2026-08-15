import { RegraTributaria, ResultadoICMSST, UF } from '@/types';

/**
 * Tabela oficial de Regras Tributárias ICMS-ST (tax_rules)
 */
export const TAX_RULES_DATABASE: RegraTributaria[] = [
  // NCM 8544.49.00 - Cabos elétricos flexíveis (SP -> SP)
  {
    id: 'tr-1',
    ncm: '8544.49.00',
    ufOrigem: 'SP',
    ufDestino: 'SP',
    aliquotaIcmsOrigem: 0.18,
    aliquotaIcmsDestino: 0.18,
    mvaST: 0.42, // MVA 42%
    protocoloIsencao: 'Protocolo ICMS SP 41/2008',
    impostoEstimado: false,
  },
  // NCM 8544.49.00 - Cabos elétricos flexíveis (SP -> MG)
  {
    id: 'tr-2',
    ncm: '8544.49.00',
    ufOrigem: 'SP',
    ufDestino: 'MG',
    aliquotaIcmsOrigem: 0.12,
    aliquotaIcmsDestino: 0.18,
    mvaST: 0.48, // MVA 48% para interestadual
    protocoloIsencao: 'Convênio ICMS 142/2018',
    impostoEstimado: false,
  },
  // NCM 3917.23.00 - Tubos PVC Esgoto/Água (SP -> SP)
  {
    id: 'tr-3',
    ncm: '3917.23.00',
    ufOrigem: 'SP',
    ufDestino: 'SP',
    aliquotaIcmsOrigem: 0.18,
    aliquotaIcmsDestino: 0.18,
    mvaST: 0.38, // MVA 38%
    impostoEstimado: false,
  },
  // NCM 3917.23.00 - Tubos PVC Esgoto/Água (SP -> MG)
  {
    id: 'tr-4',
    ncm: '3917.23.00',
    ufOrigem: 'SP',
    ufDestino: 'MG',
    aliquotaIcmsOrigem: 0.12,
    aliquotaIcmsDestino: 0.18,
    mvaST: 0.44,
    impostoEstimado: false,
  },
  // NCM 8536.20.00 - Disjuntores e chaves de proteção (SP -> SP)
  {
    id: 'tr-5',
    ncm: '8536.20.00',
    ufOrigem: 'SP',
    ufDestino: 'SP',
    aliquotaIcmsOrigem: 0.18,
    aliquotaIcmsDestino: 0.18,
    mvaST: 0.35,
    impostoEstimado: false,
  },
  // NCM 2523.29.10 - Cimento CP II 50kg (Isento ST em operações diretas de fábrica)
  {
    id: 'tr-6',
    ncm: '2523.29.10',
    ufOrigem: 'SP',
    ufDestino: 'SP',
    aliquotaIcmsOrigem: 0.18,
    aliquotaIcmsDestino: 0.18,
    mvaST: 0.0,
    protocoloIsencao: 'Isenção ST Venda Direta Indústria',
    impostoEstimado: false,
  },
];

/**
 * Calcula a Substituição Tributária (ICMS-ST) de um item de cotação
 * conforme regra de negócio oficial sara-tributacao-icms-st
 */
export function calcularICMSST(
  precoUnitario: number,
  quantidade: number,
  ncm: string,
  ufOrigem: UF = 'SP',
  ufDestino: UF = 'SP',
  regimeTributario: 'simples' | 'presumido' | 'real' = 'simples'
): ResultadoICMSST {
  // Buscar regra fiscal equivalente por NCM, UF Origem e UF Destino
  const rule = TAX_RULES_DATABASE.find(
    (r) =>
      r.ncm === ncm &&
      r.ufOrigem === ufOrigem &&
      r.ufDestino === ufDestino
  );

  // Fallback caso a regra fiscal específica não exista no banco (Imposto Estimado)
  if (!rule) {
    const mvaFallback = 0.40; // 40% MVA estimado
    const icmsOrigem = ufOrigem === ufDestino ? 0.18 : 0.12;
    const icmsDestino = 0.18;

    const baseST = precoUnitario * (1 + mvaFallback);
    const debitoDestino = baseST * icmsDestino;
    const creditoOrigem = precoUnitario * icmsOrigem;
    const valorSTUnitario = Math.max(0, debitoDestino - creditoOrigem);

    return {
      valorSTUnitario: Number(valorSTUnitario.toFixed(2)),
      valorSTTotal: Number((valorSTUnitario * quantidade).toFixed(2)),
      aliquotaEfetivaPercent: Number(((valorSTUnitario / precoUnitario) * 100).toFixed(1)),
      baseCalculoST: Number(baseST.toFixed(2)),
      isTaxEstimated: true,
      protocoloIsencao: undefined,
    };
  }

  // Se houver isenção total de ST (MVA = 0)
  if (rule.mvaST === 0) {
    return {
      valorSTUnitario: 0,
      valorSTTotal: 0,
      aliquotaEfetivaPercent: 0,
      baseCalculoST: precoUnitario,
      isTaxEstimated: rule.impostoEstimado || false,
      protocoloIsencao: rule.protocoloIsencao,
    };
  }

  // Cálculo de Substituição Tributária Padrão:
  // Base de Cálculo ST = Preço do Produto * (1 + MVA_ST)
  const baseCalculoST = precoUnitario * (1 + rule.mvaST);

  // Débito do Imposto ST = BaseCalculoST * AliquotaICMSDestino
  const debitoST = baseCalculoST * rule.aliquotaIcmsDestino;

  // Crédito do ICMS Próprio = Preço do Produto * AliquotaICMSOrigem
  const creditoICMS = precoUnitario * rule.aliquotaIcmsOrigem;

  // Valor do Imposto Retido por ST = DébitoST - CréditoICMS
  const valorSTUnitario = Math.max(0, debitoST - creditoICMS);
  const valorSTTotal = valorSTUnitario * quantidade;

  return {
    valorSTUnitario: Number(valorSTUnitario.toFixed(2)),
    valorSTTotal: Number(valorSTTotal.toFixed(2)),
    aliquotaEfetivaPercent: Number(((valorSTUnitario / precoUnitario) * 100).toFixed(1)),
    baseCalculoST: Number(baseCalculoST.toFixed(2)),
    isTaxEstimated: rule.impostoEstimado || false,
    protocoloIsencao: rule.protocoloIsencao,
  };
}
