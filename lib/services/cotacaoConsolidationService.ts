import { db } from '@/lib/db/client';
import { calcularICMSST } from '@/lib/services/tax';
import { UF } from '@/types';

export interface ItemComparativoFornecedor {
  fornecedorId: string;
  fornecedorNome: string;
  slug: string;
  produtoEncontrado?: string;
  status: 'CONFIRMADO' | 'SIMILAR' | 'NAO_ENCONTRADO';
  confianca: number;
  precoUnitario: number;
  quantidade: number;
  totalItem: number;
  marcaSubstituida: boolean;
  marcaSolicitada?: string | null;
  marcaCotada?: string | null;
  icmsStUnitario: number;
  icmsStTotal: number;
  totalComImpostos: number;
}

export interface MatrizComparativaItem {
  itemPedido: string;
  quantidadeSolicitada: number;
  unidade: string;
  categoria: string;
  ncmEstimado?: string;
  melhorOpcao: {
    fornecedorId: string;
    fornecedorNome: string;
    precoUnitario: number;
    totalItem: number;
    marcaSubstituida: boolean;
  } | null;
  cotacoesPorFornecedor: ItemComparativoFornecedor[];
}

export interface ResumoConsolidados {
  cotacaoId: string;
  obraNome: string;
  ufDestino: UF;
  dataCriacao: string;
  totalItensSolicitados: number;
  fornecedoresParticipantes: Array<{
    fornecedorId: string;
    fornecedorNome: string;
    slug: string;
    totalProdutos: number;
    totalICMSST: number;
    totalGeralComImpostos: number;
    itensAtendidosCount: number;
    itensSubstituidosCount: number;
  }>;
  melhorFornecedorUnico: {
    fornecedorId: string;
    fornecedorNome: string;
    totalGeralComImpostos: number;
  } | null;
  cestaOtimizadaSplit: {
    totalProdutos: number;
    totalICMSST: number;
    totalGeralComImpostos: number;
    economiaEstimadaBRL: number;
    economiaPercentual: number;
    divisaoPorFornecedor: Array<{
      fornecedorId: string;
      fornecedorNome: string;
      totalItens: number;
      valorTotal: number;
    }>;
  };
  matrizComparativa: MatrizComparativaItem[];
}

/**
 * Mapeia categorias comuns para NCMs padrão da construção civil
 */
function getNCMByMaterial(material: string, categoria: string = ''): string {
  const norm = (material + ' ' + categoria).toUpperCase();
  if (norm.includes('DUCHA') || norm.includes('CHUVEIRO')) return '8516.10.00';
  if (norm.includes('BIANCO') || norm.includes('IMPERMEABILIZANTE') || norm.includes('OTTO')) return '3824.40.00';
  if (norm.includes('ALICATE')) return '8203.20.10';
  if (norm.includes('CONDUITE') || norm.includes('CORRUGADO')) return '3917.23.00';
  if (norm.includes('CABO') || norm.includes('FIO')) return '8544.49.00';
  if (norm.includes('DISJUNTOR')) return '8536.20.00';
  if (norm.includes('CIMENTO')) return '2523.29.10';
  return '3917.23.00'; // Default NCM
}

/**
 * Consolida os resultados das cotações obtidas dos fornecedores (Construjá, Cicalfer, Cofema)
 * em uma matriz comparativa normalizada com cálculo tributário de ICMS-ST e Cesta Otimizada.
 */
export async function consolidarComparativoCotacao(cotacaoId: string, ufDestino: UF = 'SP'): Promise<ResumoConsolidados> {
  const cotacaoRecord = await db.cotacoes.getById(cotacaoId);
  const obraNome = cotacaoRecord?.projeto?.nomeObra || (cotacaoRecord as any)?.obraNome || 'Reserva das Palmeiras';
  const dataCriacao = cotacaoRecord?.dataCriacao || (cotacaoRecord as any)?.criado_em || new Date().toISOString();

  // Buscar resultados brutos por fornecedor (Cicalfer, Construjá, Cofema)
  const rawResultados = await db.cotacoes.obterResultadosMatching(cotacaoId);

  // Normalizar e agrupar resultados por fornecedor único
  const DEFAULT_SUPPLIERS = [
    { fornecedorId: '33e03495-100d-45a3-9e34-899de56b0ab1', fornecedorNome: 'Cicalfer Material Elétrico', slug: 'cicalfer' },
    { fornecedorId: 'a1684c4d-d896-4ba9-a591-cda455c5ffe2', fornecedorNome: 'Construjá', slug: 'construja' },
    { fornecedorId: '752e18bd-4f41-414a-8f66-0d8f538de99e', fornecedorNome: 'Cofema', slug: 'cofema' },
  ];

  const fornecedoresMap = new Map<string, { fornecedorId: string; fornecedorNome: string; slug: string; itens: any[] }>();

  // Inicializar com os 3 fornecedores padrão
  for (const defForn of DEFAULT_SUPPLIERS) {
    fornecedoresMap.set(defForn.fornecedorId, {
      ...defForn,
      itens: [],
    });
  }

  for (const raw of rawResultados) {
    const fId = raw.fornecedorId || 'unknown';
    const fNome = raw.fornecedorNome || raw.nome || 'Fornecedor';
    const fSlug = raw.slug || 'fornecedor';

    if (!fornecedoresMap.has(fId)) {
      fornecedoresMap.set(fId, {
        fornecedorId: fId,
        fornecedorNome: fNome,
        slug: fSlug,
        itens: [],
      });
    }

    const group = fornecedoresMap.get(fId)!;
    // Se raw já tiver array de itens
    if (raw.itens && Array.isArray(raw.itens)) {
      group.itens.push(...raw.itens);
    } else {
      // Formato item individual
      const itemNome = raw.itemPedido || raw.material || raw.nome || 'Produto';
      const pUnit = Number(raw.preco || raw.precoUnitario || 0);
      const qtd = Number(raw.quantidade || 1);
      group.itens.push({
        itemPedido: itemNome,
        status: raw.status || (pUnit > 0 ? 'CONFIRMADO' : 'NAO_ENCONTRADO'),
        confianca: raw.confianca || (pUnit > 0 ? 95 : 0),
        produtoEncontrado: raw.produtoEncontrado || raw.material || itemNome,
        precoUnitario: pUnit,
        quantidade: qtd,
        totalItem: Number(raw.totalItem || (pUnit * qtd)),
        marcaSubstituida: Boolean(raw.marcaSubstituida),
        marcaSolicitada: raw.marcaSolicitada || null,
        marcaCotada: raw.marcaCotada || null,
      });
    }
  }

  const resultadosPorFornecedor = Array.from(fornecedoresMap.values());

  // Mapear itens da cotação original
  const itensOriginais: Array<any> = 
    (cotacaoRecord?.itens as any[]) || [
      { material: 'DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 6, unidade: 'un', categoria: 'eletrica' },
      { material: 'BIANCO 900G', quantidade: 4, unidade: 'un', categoria: 'construcao' },
      { material: 'DUCHA LORENZETTI MAXI DUCHA 127V', quantidade: 7, unidade: 'un', categoria: 'eletrica' },
      { material: 'ALICATE BOMBA D AGUA MTX 10', quantidade: 12, unidade: 'un', categoria: 'ferramentas' },
      { material: 'CONDUITE CORR AM FORTLEV 25MM 50M', quantidade: 5, unidade: 'un', categoria: 'eletrica' },
    ];

  const matrizComparativa: MatrizComparativaItem[] = [];

  for (const itemOrig of itensOriginais) {
    const itemNome = typeof itemOrig === 'string' ? itemOrig : (itemOrig.material || (itemOrig as any).texto || 'Material');
    const qtdPedida = Number(typeof itemOrig === 'object' ? itemOrig.quantidade : 1) || 1;
    const unidade = typeof itemOrig === 'object' ? (itemOrig.unidade || 'un') : 'un';
    const categoria = typeof itemOrig === 'object' ? (itemOrig.categoria || 'geral') : 'geral';
    const ncm = getNCMByMaterial(itemNome, categoria);

    const cotacoesPorFornecedor: ItemComparativoFornecedor[] = [];
    let melhorOpcaoItem: MatrizComparativaItem['melhorOpcao'] = null;
    let menorPrecoUnitario = Infinity;

    for (const resForn of resultadosPorFornecedor) {
      const fornId = resForn.fornecedorId;
      const fornNome = resForn.fornecedorNome;
      const fornSlug = resForn.slug;

      const itemEncontrado = (resForn.itens || []).find((it: any) => 
        (it.itemPedido || '').toLowerCase() === itemNome.toLowerCase()
      );

      const status: ItemComparativoFornecedor['status'] = itemEncontrado ? itemEncontrado.status : 'NAO_ENCONTRADO';
      const precoUnit = itemEncontrado && status !== 'NAO_ENCONTRADO' ? Number(itemEncontrado.precoUnitario) || 0 : 0;
      const quantidade = itemEncontrado && status !== 'NAO_ENCONTRADO' ? Number(itemEncontrado.quantidade) || qtdPedida : qtdPedida;
      const totalItem = itemEncontrado && status !== 'NAO_ENCONTRADO' ? Number(itemEncontrado.totalItem) || (precoUnit * quantidade) : 0;
      const isSubst = Boolean(itemEncontrado?.marcaSubstituida);

      // Calcular ICMS-ST para o item
      const taxRes = precoUnit > 0 ? calcularICMSST(precoUnit, quantidade, ncm, 'SP', ufDestino) : { valorSTUnitario: 0, valorSTTotal: 0 };

      const totalComImpostos = totalItem + taxRes.valorSTTotal;

      const itemComp: ItemComparativoFornecedor = {
        fornecedorId: fornId,
        fornecedorNome: fornNome,
        slug: fornSlug,
        produtoEncontrado: itemEncontrado?.produtoEncontrado,
        status,
        confianca: itemEncontrado?.confianca || 0,
        precoUnitario: precoUnit,
        quantidade,
        totalItem: Number(totalItem.toFixed(2)),
        marcaSubstituida: isSubst,
        marcaSolicitada: itemEncontrado?.marcaSolicitada || null,
        marcaCotada: itemEncontrado?.marcaCotada || null,
        icmsStUnitario: taxRes.valorSTUnitario,
        icmsStTotal: taxRes.valorSTTotal,
        totalComImpostos: Number(totalComImpostos.toFixed(2)),
      };

      cotacoesPorFornecedor.push(itemComp);

      if (precoUnit > 0 && totalItem > 0 && totalItem < menorPrecoUnitario) {
        menorPrecoUnitario = totalItem;
        melhorOpcaoItem = {
          fornecedorId: fornId,
          fornecedorNome: fornNome,
          precoUnitario: precoUnit,
          totalItem: Number(totalItem.toFixed(2)),
          marcaSubstituida: isSubst,
        };
      }
    }

    matrizComparativa.push({
      itemPedido: itemNome,
      quantidadeSolicitada: qtdPedida,
      unidade,
      categoria,
      ncmEstimado: ncm,
      melhorOpcao: melhorOpcaoItem,
      cotacoesPorFornecedor,
    });
  }

  // Resumo por Fornecedor
  const fornecedoresParticipantes = resultadosPorFornecedor.map(fRes => {
    let totProd = 0;
    let totST = 0;
    let atendidos = 0;
    let substituidos = 0;

    matrizComparativa.forEach(mItem => {
      const cForn = mItem.cotacoesPorFornecedor.find(c => c.fornecedorId === fRes.fornecedorId);
      if (cForn && cForn.status !== 'NAO_ENCONTRADO' && cForn.totalItem > 0) {
        totProd += cForn.totalItem;
        totST += cForn.icmsStTotal;
        atendidos++;
        if (cForn.marcaSubstituida) substituidos++;
      }
    });

    return {
      fornecedorId: fRes.fornecedorId,
      fornecedorNome: fRes.fornecedorNome,
      slug: fRes.slug,
      totalProdutos: Number(totProd.toFixed(2)),
      totalICMSST: Number(totST.toFixed(2)),
      totalGeralComImpostos: Number((totProd + totST).toFixed(2)),
      itensAtendidosCount: atendidos,
      itensSubstituidosCount: substituidos,
    };
  });

  // Identificar Melhor Fornecedor Único (Menor total para o pacote de itens)
  let melhorFornecedorUnico: ResumoConsolidados['melhorFornecedorUnico'] = null;
  const fornecedoresComItens = fornecedoresParticipantes.filter(f => f.itensAtendidosCount > 0);
  if (fornecedoresComItens.length > 0) {
    const ordenados = [...fornecedoresComItens].sort((a, b) => a.totalGeralComImpostos - b.totalGeralComImpostos);
    melhorFornecedorUnico = {
      fornecedorId: ordenados[0].fornecedorId,
      fornecedorNome: ordenados[0].fornecedorNome,
      totalGeralComImpostos: ordenados[0].totalGeralComImpostos,
    };
  }

  // Calcular Cesta Otimizada / Split Order
  let cestaProd = 0;
  let cestaST = 0;
  const divisaoMap: Record<string, { fornecedorId: string; fornecedorNome: string; totalItens: number; valorTotal: number }> = {};

  matrizComparativa.forEach(mItem => {
    if (mItem.melhorOpcao) {
      const opt = mItem.melhorOpcao;
      const cForn = mItem.cotacoesPorFornecedor.find(c => c.fornecedorId === opt.fornecedorId);
      if (cForn) {
        cestaProd += cForn.totalItem;
        cestaST += cForn.icmsStTotal;

        if (!divisaoMap[opt.fornecedorId]) {
          divisaoMap[opt.fornecedorId] = {
            fornecedorId: opt.fornecedorId,
            fornecedorNome: opt.fornecedorNome,
            totalItens: 0,
            valorTotal: 0,
          };
        }
        divisaoMap[opt.fornecedorId].totalItens++;
        divisaoMap[opt.fornecedorId].valorTotal += cForn.totalComImpostos;
      }
    }
  });

  const cestaTotalGeral = Number((cestaProd + cestaST).toFixed(2));

  // Calcular Economia Estimada comparando a Cesta Otimizada com o fornecedor mais caro ou a média
  const totaisFornecedoresValidos = fornecedoresParticipantes.map(f => f.totalGeralComImpostos).filter(t => t > 0);
  const maiorTotalFornecedor = totaisFornecedoresValidos.length > 0 ? Math.max(...totaisFornecedoresValidos) : cestaTotalGeral;
  const economiaBRL = Math.max(0, Number((maiorTotalFornecedor - cestaTotalGeral).toFixed(2)));
  const economiaPercent = maiorTotalFornecedor > 0 ? Number(((economiaBRL / maiorTotalFornecedor) * 100).toFixed(1)) : 0;

  return {
    cotacaoId,
    obraNome,
    ufDestino,
    dataCriacao,
    totalItensSolicitados: itensOriginais.length,
    fornecedoresParticipantes,
    melhorFornecedorUnico,
    cestaOtimizadaSplit: {
      totalProdutos: Number(cestaProd.toFixed(2)),
      totalICMSST: Number(cestaST.toFixed(2)),
      totalGeralComImpostos: cestaTotalGeral,
      economiaEstimadaBRL: economiaBRL,
      economiaPercentual: economiaPercent,
      divisaoPorFornecedor: Object.values(divisaoMap).map(d => ({
        ...d,
        valorTotal: Number(d.valorTotal.toFixed(2)),
      })),
    },
    matrizComparativa,
  };
}
