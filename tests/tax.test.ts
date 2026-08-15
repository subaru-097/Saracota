import { calcularICMSST } from '../lib/services/tax';

/**
 * Suíte de Testes Unitários para o Motor de Cálculo de ICMS-ST
 * (Conforme diretrizes de sara-tributacao-icms-st)
 */
export function testarMotorICMSST() {
  const resultados: { nome: string; passou: boolean; mensagem: string }[] = [];

  // Teste 1: Cálculo Padrão SP -> SP para Cabos Elétricos (NCM 8544.49.00)
  try {
    const res = calcularICMSST(10.0, 100, '8544.49.00', 'SP', 'SP');
    // Preço: 10, MVA: 0.42 => BaseST = 14.20
    // Débito Destino = 14.20 * 0.18 = 2.556
    // Crédito Origem = 10 * 0.18 = 1.80
    // Valor ST Unitario = 2.556 - 1.80 = 0.756 -> ~0.76
    const passou = res.valorSTUnitario > 0 && !res.isTaxEstimated && res.protocoloIsencao !== undefined;
    resultados.push({
      nome: 'Cálculo ICMS-ST SP->SP NCM 8544.49.00',
      passou,
      mensagem: `ST Unitário: R$ ${res.valorSTUnitario} | BaseST: R$ ${res.baseCalculoST}`,
    });
  } catch (e: any) {
    resultados.push({ nome: 'Cálculo ICMS-ST SP->SP NCM 8544.49.00', passou: false, mensagem: e.message });
  }

  // Teste 2: Isenção Tributária Venda Direta Indústria para Cimento (NCM 2523.29.10)
  try {
    const res = calcularICMSST(33.5, 10, '2523.29.10', 'SP', 'SP');
    const passou = res.valorSTUnitario === 0 && res.valorSTTotal === 0;
    resultados.push({
      nome: 'Isenção ICMS-ST Venda Direta Cimento (NCM 2523.29.10)',
      passou,
      mensagem: `ST Unitário: R$ ${res.valorSTUnitario} (Isento) | Protocolo: ${res.protocoloIsencao}`,
    });
  } catch (e: any) {
    resultados.push({ nome: 'Isenção ICMS-ST Cimento', passou: false, mensagem: e.message });
  }

  // Teste 3: Fallback de Imposto Estimado para NCM Desconhecido
  try {
    const res = calcularICMSST(50.0, 5, '9999.99.99', 'SP', 'MG');
    const passou = res.isTaxEstimated === true && res.valorSTUnitario > 0;
    resultados.push({
      nome: 'Imposto Estimado para NCM Não Cadastrado',
      passou,
      mensagem: `Imposto Estimado: ${res.isTaxEstimated} | ST Unitário: R$ ${res.valorSTUnitario}`,
    });
  } catch (e: any) {
    resultados.push({ nome: 'Imposto Estimado NCM Desconhecido', passou: false, mensagem: e.message });
  }

  return resultados;
}
