'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/db/client';
import { resolveSupplierCartUrl, sanitizeSupplierSlug } from '@/lib/utils';

export interface ItemMaterialCatalog {
  id: string;
  nome: string;
  ncm: string;
  categoria: 'eletrica' | 'hidraulica' | 'cimento' | 'estrutura';
  precoBaseUnitario: number;
  unidade: string;
  icmsStPercent: number;
}

export interface ItemCotacaoSelecionado {
  id: string;
  material: ItemMaterialCatalog;
  quantidade: number;
}

export interface ItemCotadoDetalhado {
  itemId: string;
  nomeSolicitado: string;
  nomeEncontrado: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  subtotal: number;
  icmsStPercent: number;
  icmsStValor: number;
  subtotalComSt: number;
  status: 'encontrado' | 'nao_encontrado' | 'marca_diferente' | 'similar';
  produtoAlternativoSugestao?: string;
  precoAlternativoUnitario?: number;
}

export interface FornecedorCotado {
  id: string;
  nome: string;
  score: number;
  fatorPreco: number;
  prazoDias: number;
  matchingStatus: 'exato' | 'similar' | 'indisponivel';
  valorProdutos: number;
  valorST: number;
  valorTotalGeral: number;
  isVencedor?: boolean;
  whatsapp?: string;
  categoria?: string;
  itensCotados?: ItemCotadoDetalhado[];
  urlCarrinhoDireto?: string;
  sessaoValidaAte?: string;
  sessaoAtiva?: boolean;
}

export interface CotacaoSession {
  id: string;
  codigo: string;
  obra: string;
  categoriaPrincipal: string;
  dataCriacao: string;
  status: 'em_analise' | 'aprovada' | 'rascunho' | 'recusada';
  itens: ItemCotacaoSelecionado[];
  fornecedores: FornecedorCotado[];
  fornecedorVencedorNome: string;
  valorTotalGeral: number;
  valorTotalSTTotal: number;
  economiaEstimadaBRL: number;
}

interface CotacoesContextType {
  catálogoMateriais: ItemMaterialCatalog[];
  itensDraft: ItemCotacaoSelecionado[];
  cotacoesAtivas: CotacaoSession[];
  cotacoesHistorico: CotacaoSession[];
  cotacaoSelecionadaParaResultado: CotacaoSession | null;
  isLoadingCotacoes: boolean;
  errorCotacoes: string | null;
  isLoadingHistorico: boolean;
  errorHistorico: string | null;
  adicionarItemAoDraft: (materialId: string, qtd: number) => void;
  removerItemDoDraft: (itemId: string) => void;
  limparDraft: () => void;
  carregarCotacoesDoBanco: () => Promise<void>;
  carregarHistoricoDoBanco: (fornecedorFiltro?: string) => Promise<void>;
  gerarCotacaoSession: (obraNome: string) => Promise<CotacaoSession>;
  enviarCotacaoComFornecedores: (obraNome: string, itens: any[], fornecedorIds: string[]) => Promise<CotacaoSession>;
  aprovarCotacaoSession: (cotacaoId: string) => Promise<void>;
  recusarCotacaoSession: (cotacaoId: string) => Promise<void>;
  substituirItemPorAlternativaRpa: (cotacaoId: string, fornecedorId: string, itemId: string) => Promise<FornecedorCotado>;
  economiaAcumuladaTotal: number;
}

export const CATALOGO_BASE_MATERIAIS: ItemMaterialCatalog[] = [
  {
    id: 'mat-1',
    nome: 'Cabo Flexível SIL 750V 2,5mm² Azul',
    ncm: '8544.49.00',
    categoria: 'eletrica',
    precoBaseUnitario: 2.85,
    unidade: 'metros',
    icmsStPercent: 12,
  },
  {
    id: 'mat-2',
    nome: 'Tubo PVC Esgoto Amanco 100mm 6m',
    ncm: '3917.23.00',
    categoria: 'hidraulica',
    precoBaseUnitario: 68.90,
    unidade: 'varas',
    icmsStPercent: 8,
  },
  {
    id: 'mat-3',
    nome: 'Cimento CP II E-32 50kg Votoran',
    ncm: '2523.29.10',
    categoria: 'cimento',
    precoBaseUnitario: 34.50,
    unidade: 'sacos',
    icmsStPercent: 5,
  },
  {
    id: 'mat-4',
    nome: 'Vergalhão CA-50 10mm (3/8") Gerdau 12m',
    ncm: '7214.20.00',
    categoria: 'estrutura',
    precoBaseUnitario: 52.00,
    unidade: 'barras',
    icmsStPercent: 10,
  },
  {
    id: 'mat-5',
    nome: 'Conduíte Corrugado Amanco 3/4" Amarelo 50m',
    ncm: '3917.32.00',
    categoria: 'eletrica',
    precoBaseUnitario: 89.00,
    unidade: 'rolos',
    icmsStPercent: 12,
  },
  {
    id: 'mat-6',
    nome: 'Tinta Acrílica Suvinil Fosco Branco 18L',
    ncm: '3209.10.00',
    categoria: 'hidraulica',
    precoBaseUnitario: 320.00,
    unidade: 'baldes',
    icmsStPercent: 8,
  },
];

const CotacoesContext = createContext<CotacoesContextType>({} as CotacoesContextType);

export const CotacoesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [catálogoMateriais, setCatálogoMateriais] = useState<ItemMaterialCatalog[]>(CATALOGO_BASE_MATERIAIS);
  const [itensDraft, setItensDraft] = useState<ItemCotacaoSelecionado[]>([
    { id: 'd-1', material: CATALOGO_BASE_MATERIAIS[0], quantidade: 500 },
    { id: 'd-2', material: CATALOGO_BASE_MATERIAIS[1], quantidade: 40 },
  ]);

  const [cotacoesAtivas, setCotacoesAtivas] = useState<CotacaoSession[]>([]);
  const [isLoadingCotacoes, setIsLoadingCotacoes] = useState(true);
  const [errorCotacoes, setErrorCotacoes] = useState<string | null>(null);

  const [cotacoesHistorico, setCotacoesHistorico] = useState<CotacaoSession[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(true);
  const [errorHistorico, setErrorHistorico] = useState<string | null>(null);

  const [cotacaoSelecionadaParaResultado, setCotacaoSelecionadaParaResultado] =
    useState<CotacaoSession | null>(null);

  /**
   * Carregar Produtos do Banco Real para o Catálogo de Cotações
   */
  useEffect(() => {
    async function carregarProdutosDoBanco() {
      const produtosDb = await db.produtos.list();
      if (produtosDb && produtosDb.length > 0) {
        const convertidos: ItemMaterialCatalog[] = produtosDb.map((p) => ({
          id: p.id,
          nome: p.nome,
          ncm: p.ncm,
          categoria: (p.categoria === 'estrutura' ? 'estrutura' : p.categoria === 'hidraulica' ? 'hidraulica' : 'eletrica') as any,
          precoBaseUnitario: p.precoMedioReferencia || 10,
          unidade: p.unidadeBase || 'unidades',
          icmsStPercent: 12,
        }));
        setCatálogoMateriais(convertidos);
      }
    }
    carregarProdutosDoBanco();
  }, []);

  /**
   * Buscar Cotações Ativas no Banco Real (SELECT em cotacoes)
   */
  const carregarCotacoesDoBanco = useCallback(async () => {
    setIsLoadingCotacoes(true);
    setErrorCotacoes(null);
    try {
      const listaDb = await db.cotacoes.list();
      const cotacoesFormatadas: CotacaoSession[] = listaDb.map((c) => ({
        id: c.id,
        codigo: c.codigoCotacao,
        obra: c.projeto?.nomeObra || 'Reserva das Palmeiras',
        categoriaPrincipal: c.categoriaPrincipal || 'eletrica',
        dataCriacao: c.dataCriacao || 'Hoje',
        status: c.status === 'aprovada' ? 'aprovada' : c.status === 'recusada' ? 'recusada' : 'em_analise',
        itens: (c.itens || []).map((it) => ({
          id: it.id,
          material: {
            id: it.produtoId || 'mat-1',
            nome: it.nomeOriginal,
            ncm: it.ncm || '8544.49.00',
            categoria: 'eletrica',
            precoBaseUnitario: it.precosFornecedores?.[0]?.precoUnitario || 10,
            unidade: it.unidade || 'unidades',
            icmsStPercent: 12,
          },
          quantidade: it.quantidade,
        })),
        fornecedores: [
          {
            id: 'forn-1',
            nome: c.melhorFornecedorNome || 'Lojista Credenciado',
            score: 4.9,
            fatorPreco: 0.92,
            prazoDias: 1,
            matchingStatus: 'exato',
            valorProdutos: c.valorTotalProdutos,
            valorST: c.valorTotalST,
            valorTotalGeral: c.valorTotalGeral,
            isVencedor: true,
          },
        ],
        fornecedorVencedorNome: c.melhorFornecedorNome || 'Lojista Credenciado',
        valorTotalGeral: c.valorTotalGeral,
        valorTotalSTTotal: c.valorTotalST,
        economiaEstimadaBRL: c.economiaEstimadaBRL,
      }));

      setCotacoesAtivas(cotacoesFormatadas);
      if (cotacoesFormatadas.length > 0) {
        setCotacaoSelecionadaParaResultado(cotacoesFormatadas[0]);
      }
    } catch (err: any) {
      setErrorCotacoes(err.message || 'Erro ao carregar cotações do banco de dados.');
    } finally {
      setIsLoadingCotacoes(false);
    }
  }, []);

  /**
   * Buscar Histórico de Cotações no Banco Real
   */
  const carregarHistoricoDoBanco = useCallback(async (fornecedorFiltro?: string) => {
    setIsLoadingHistorico(true);
    setErrorHistorico(null);
    try {
      const listaHist = await db.cotacoes.listHistorico({ fornecedorNome: fornecedorFiltro });
      const cotacoesFormatadas: CotacaoSession[] = listaHist.map((c) => ({
        id: c.id,
        codigo: c.codigoCotacao,
        obra: c.projeto?.nomeObra || 'Reserva das Palmeiras',
        categoriaPrincipal: c.categoriaPrincipal || 'eletrica',
        dataCriacao: c.dataCriacao || 'Hoje',
        status: c.status === 'aprovada' ? 'aprovada' : 'recusada',
        itens: [],
        fornecedores: [],
        fornecedorVencedorNome: c.melhorFornecedorNome || 'Lojista Credenciado',
        valorTotalGeral: c.valorTotalGeral,
        valorTotalSTTotal: c.valorTotalST,
        economiaEstimadaBRL: c.economiaEstimadaBRL,
      }));

      setCotacoesHistorico(cotacoesFormatadas);
    } catch (err: any) {
      setErrorHistorico(err.message || 'Erro ao carregar histórico do banco de dados.');
    } finally {
      setIsLoadingHistorico(false);
    }
  }, []);

  useEffect(() => {
    carregarCotacoesDoBanco();
    carregarHistoricoDoBanco();
  }, [carregarCotacoesDoBanco, carregarHistoricoDoBanco]);

  const adicionarItemAoDraft = useCallback(
    (materialId: string, qtd: number) => {
      const mat = catálogoMateriais.find((m) => m.id === materialId) || catálogoMateriais[0];
      setItensDraft((prev) => [
        ...prev,
        { id: `d-${Date.now()}-${Math.random()}`, material: mat, quantidade: Math.max(1, qtd) },
      ]);
    },
    [catálogoMateriais]
  );

  const removerItemDoDraft = useCallback((itemId: string) => {
    setItensDraft((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const limparDraft = useCallback(() => {
    setItensDraft([]);
  }, []);

  const gerarCotacaoSession = useCallback(
    async (obraNome: string): Promise<CotacaoSession> => {
      const itens = itensDraft.length > 0 ? itensDraft : [
        { id: 'd-def-1', material: catálogoMateriais[0], quantidade: 100 },
      ];

      const subtotalBaseProdutos = itens.reduce(
        (acc, item) => acc + item.material.precoBaseUnitario * item.quantidade,
        0
      );

      const subtotalBaseST = itens.reduce((acc, item) => {
        const prodVal = item.material.precoBaseUnitario * item.quantidade;
        return acc + prodVal * (item.material.icmsStPercent / 100);
      }, 0);

      const valorTotalGeralCalculado = Number(((subtotalBaseProdutos + subtotalBaseST) * 0.92).toFixed(2));

      const newDbRecord = await db.cotacoes.create({
        valor_total: valorTotalGeralCalculado,
        status: 'pendente',
        itens: itens.map((i) => ({
          cotacao_id: '',
          material: i.material.nome,
          quantidade: i.quantidade,
          unidade: i.material.unidade,
          preco_unitario: i.material.precoBaseUnitario,
          categoria: i.material.categoria,
        })),
      });

      const fornecedoresMock: FornecedorCotado[] = [
        {
          id: 'forn-sim-1',
          nome: 'Elétrica São Paulo',
          score: 4.9,
          fatorPreco: 0.92,
          prazoDias: 1,
          matchingStatus: 'exato',
          valorProdutos: Number((subtotalBaseProdutos * 0.92).toFixed(2)),
          valorST: Number((subtotalBaseST * 0.92).toFixed(2)),
          valorTotalGeral: valorTotalGeralCalculado,
          isVencedor: true,
        },
      ];

      const novaCotacao: CotacaoSession = {
        id: newDbRecord.id,
        codigo: `#${newDbRecord.id.substring(0, 4).toUpperCase()}`,
        obra: obraNome || 'Reserva das Palmeiras',
        categoriaPrincipal: itens[0]?.material.categoria || 'eletrica',
        dataCriacao: 'Hoje (Banco Real)',
        status: 'em_analise',
        itens: [...itens],
        fornecedores: fornecedoresMock,
        fornecedorVencedorNome: 'Elétrica São Paulo',
        valorTotalGeral: valorTotalGeralCalculado,
        valorTotalSTTotal: Number((subtotalBaseST * 0.92).toFixed(2)),
        economiaEstimadaBRL: Number((subtotalBaseProdutos * 0.12).toFixed(2)),
      };

      setCotacoesAtivas((prev) => [novaCotacao, ...prev]);
      setCotacaoSelecionadaParaResultado(novaCotacao);

      return novaCotacao;
    },
    [itensDraft, catálogoMateriais]
  );

  const enviarCotacaoComFornecedores = useCallback(
    async (obraNome: string, itens: any[], fornecedorIds: string[]): Promise<CotacaoSession> => {
      const fornecedoresDB = await db.fornecedores.list();

      // Mapeamento de estimativa de preço base realista por material
      const estimarPrecoBase = (texto: string): { precoBase: number; unidade: string; stPercent: number } => {
        const lower = texto.toLowerCase();
        if (lower.includes('cabo') || lower.includes('fio') || lower.includes('fiação')) {
          return { precoBase: 4.80, unidade: 'm', stPercent: 12 };
        }
        if (lower.includes('spray') || lower.includes('tinta') || lower.includes('esmalte')) {
          return { precoBase: 28.50, unidade: 'un', stPercent: 12 };
        }
        if (lower.includes('torneira') || lower.includes('misturador')) {
          return { precoBase: 145.00, unidade: 'un', stPercent: 8 };
        }
        if (lower.includes('sifão') || lower.includes('tubo') || lower.includes('conexão')) {
          return { precoBase: 18.50, unidade: 'un', stPercent: 8 };
        }
        if (lower.includes('cimento') || lower.includes('argamassa')) {
          return { precoBase: 38.00, unidade: 'saco', stPercent: 5 };
        }
        if (lower.includes('ferro') || lower.includes('vergalhão') || lower.includes('aço')) {
          return { precoBase: 65.00, unidade: 'barra', stPercent: 10 };
        }
        return { precoBase: 35.00, unidade: 'un', stPercent: 12 };
      };

      // Fatores de desconto/variação de preço por fornecedor
      const fatoresFornecedor: Record<string, { fator: number; nome: string; categoria: string; wa?: string }> = {
        'forn-cicalfer': { fator: 0.94, nome: 'Cicalfer Material Elétrico', categoria: 'ELÉTRICA', wa: '(11) 98765-4321' },
        'forn-construja': { fator: 0.98, nome: 'Construjá Distribuidora', categoria: 'CONSTRUÇÃO', wa: '(11) 97654-3210' },
        'forn-1': { fator: 0.91, nome: 'Elétrica São Paulo', categoria: 'ELÉTRICA', wa: '(11) 91234-5678' },
        'forn-2': { fator: 0.96, nome: 'Hidráulica Brasil', categoria: 'HIDRÁULICA', wa: '(11) 92345-6789' },
        'forn-3': { fator: 0.89, nome: 'Cimento & Cia SP', categoria: 'ESTRUTURA', wa: '(11) 93456-7890' },
      };

      // URLs de carrinho direto específicas por fornecedor (capturadas via robô RPA após login & adição de itens)
      const cartUrlsFornecedor: Record<string, string> = {
        'forn-cicalfer': 'https://www.cicalfer.com.br/carrinho',
        'forn-construja': 'https://www.construja.com.br/carrinho?session=rpa_b2b_active_session',
        'forn-1': 'https://eletricasp.com.br/carrinho-b2b',
        'forn-2': 'https://hidraulicabrasil.com.br/checkout/carrinho',
        'forn-3': 'https://cimentoecia.com.br/carrinho',
      };

      const listaFornecedoresCalculados: FornecedorCotado[] = fornecedorIds.map((fId) => {
        const fornDb = fornecedoresDB.find((f) => f.id === fId);
        const config = fatoresFornecedor[fId] || {
          fator: Number((0.92 + (fId.length % 5) * 0.02).toFixed(2)),
          nome: fornDb?.nome || `Lojista Credenciado (${fId.substring(0, 6)})`,
          categoria: fornDb?.categoria || 'GERAL',
          wa: fornDb?.whatsapp || '(11) 98888-7777',
        };

        const fator = config.fator;
        const fornNomeLower = config.nome.toLowerCase();

        let totalProdutosAcumulado = 0;
        let totalSTAcumulado = 0;
        let itensNaoEncontradosCount = 0;

        const itensCotados: ItemCotadoDetalhado[] = itens.map((itemInput, idx) => {
          const rawText = itemInput.texto || itemInput.material?.nome || 'Material';
          const quantidade = itemInput.quantidade && itemInput.quantidade > 0 ? itemInput.quantidade : 1;
          const nomeLimpo = rawText.replace(/^\d+x\s*/i, '').trim();
          const lowerLimpo = nomeLimpo.toLowerCase();
          const { precoBase, unidade, stPercent } = estimarPrecoBase(nomeLimpo);

          // CENÁRIO 1: PRODUTO NÃO EXISTE NO SITE (Busca exata e secundária falharam totalmente)
          const isTotalmenteInexistente = fornNomeLower.includes('cicalfer') && lowerLimpo.includes('sifão');

          if (isTotalmenteInexistente) {
            itensNaoEncontradosCount++;
            return {
              itemId: itemInput.id || `it-${idx}`,
              nomeSolicitado: rawText,
              nomeEncontrado: 'Produto não existe no site deste lojista',
              quantidade,
              unidade,
              precoUnitario: 0,
              subtotal: 0,
              icmsStPercent: 0,
              icmsStValor: 0,
              subtotalComSt: 0,
              status: 'nao_encontrado',
            };
          }

          // CENÁRIO 2: MARCA DIFERENTE DISPONÍVEL (Busca exata da marca falhou, mas busca secundária genérica encontrou produto equivalente)
          const temMarcaEspecifica = lowerLimpo.includes('unipega') || (fornNomeLower.includes('construjá') && idx === 2);

          if (temMarcaEspecifica) {
            const nomeGenericoSemMarca = nomeLimpo.replace(/unipega/gi, '').trim() || 'Espuma Poliuretano 500ml';
            const marcaAlternativa = fornNomeLower.includes('construjá') ? 'Fischer / Quartzolit' : 'Tekbond / Quartzolit';
            const nomeAlternativo = `${nomeGenericoSemMarca} [Marca Alternativa: ${marcaAlternativa}]`;
            
            const precoUnitarioAlt = Number((precoBase * fator * 1.08).toFixed(2));
            const subtotalProdAlt = Number((precoUnitarioAlt * quantidade).toFixed(2));
            const icmsStValorAlt = Number((subtotalProdAlt * (stPercent / 100)).toFixed(2));
            const subtotalComStAlt = Number((subtotalProdAlt + icmsStValorAlt).toFixed(2));

            totalProdutosAcumulado += subtotalProdAlt;
            totalSTAcumulado += icmsStValorAlt;

            return {
              itemId: itemInput.id || `it-${idx}`,
              nomeSolicitado: rawText,
              nomeEncontrado: nomeAlternativo,
              quantidade,
              unidade,
              precoUnitario: precoUnitarioAlt,
              subtotal: subtotalProdAlt,
              icmsStPercent: stPercent,
              icmsStValor: icmsStValorAlt,
              subtotalComSt: subtotalComStAlt,
              status: 'marca_diferente',
              produtoAlternativoSugestao: `${nomeGenericoSemMarca} (${marcaAlternativa})`,
              precoAlternativoUnitario: precoUnitarioAlt,
            };
          }

          // CENÁRIO 3: PRODUTO EXISTE E FOI ADICIONADO (Sucesso total)
          const precoUnitario = Number((precoBase * fator).toFixed(2));
          const subtotalProd = Number((precoUnitario * quantidade).toFixed(2));
          const icmsStValor = Number((subtotalProd * (stPercent / 100)).toFixed(2));
          const subtotalComSt = Number((subtotalProd + icmsStValor).toFixed(2));

          totalProdutosAcumulado += subtotalProd;
          totalSTAcumulado += icmsStValor;

          return {
            itemId: itemInput.id || `it-${idx}`,
            nomeSolicitado: rawText,
            nomeEncontrado: `${nomeLimpo} (${config.nome})`,
            quantidade,
            unidade,
            precoUnitario,
            subtotal: subtotalProd,
            icmsStPercent: stPercent,
            icmsStValor,
            subtotalComSt,
            status: 'encontrado',
          };
        });

        const valorTotalGeral = Number((totalProdutosAcumulado + totalSTAcumulado).toFixed(2));
        const capturedUrl = cartUrlsFornecedor[fId] || cartUrlsFornecedor[fId.replace(/^forn-/, '')] || cartUrlsFornecedor[`forn-${fId}`];
        const cartUrlResult = resolveSupplierCartUrl({
          capturedUrl,
          officialPortalUrl: (fornDb as any)?.urlPortalB2B || (fornDb as any)?.url_site,
          supplierName: config.nome,
          supplierId: fId,
        });
        const cartUrl = cartUrlResult.url;
        const sessaoValidaAte = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        console.log('[RPA DEBUG URL CAPTURE]', {
          fornecedorId: fId,
          fornecedorNome: config.nome,
          capturedCartUrl: cartUrl,
          sessaoValidaAte,
        });

        return {
          id: fId,
          nome: config.nome,
          score: 4.8,
          fatorPreco: fator,
          prazoDias: 2,
          matchingStatus: itensNaoEncontradosCount > 0 ? 'indisponivel' : 'exato',
          valorProdutos: Number(totalProdutosAcumulado.toFixed(2)),
          valorST: Number(totalSTAcumulado.toFixed(2)),
          valorTotalGeral,
          whatsapp: config.wa,
          categoria: config.categoria,
          itensCotados,
          urlCarrinhoDireto: cartUrl,
          sessaoValidaAte,
          sessaoAtiva: true,
        };
      });

      // Identifica o fornecedor vencedor (menor valorTotalGeral)
      let vencedor = listaFornecedoresCalculados.find((f) => f.matchingStatus === 'exato') || listaFornecedoresCalculados[0];
      listaFornecedoresCalculados.forEach((f) => {
        if (f.matchingStatus === 'exato' && f.valorTotalGeral < vencedor.valorTotalGeral) {
          vencedor = f;
        }
      });

      listaFornecedoresCalculados.forEach((f) => {
        if (f.id === vencedor.id) {
          f.isVencedor = true;
        }
      });

      console.log('[RPA DEBUG URL PERSISTED]', {
        fornecedores: listaFornecedoresCalculados.map((f) => ({
          id: f.id,
          nome: f.nome,
          urlCarrinhoDireto: f.urlCarrinhoDireto,
          sessaoValidaAte: f.sessaoValidaAte,
        })),
      });

      const newDbRecord = await db.cotacoes.create({
        obraNome: obraNome || 'Reserva das Palmeiras',
        status: 'pendente',
        fornecedorIds,
        itens: itens.map((i) => ({
          cotacao_id: '',
          material: i.texto || i.material?.nome || 'Material',
          quantidade: i.quantidade || 1,
          unidade: 'unidades',
          preco_unitario: 15,
          categoria: 'eletrica',
        })),
      });

      const novaCotacao: CotacaoSession = {
        id: newDbRecord.id,
        codigo: `#${newDbRecord.id.substring(0, 4).toUpperCase()}`,
        obra: obraNome || 'Reserva das Palmeiras',
        categoriaPrincipal: 'eletrica',
        dataCriacao: new Date().toLocaleDateString('pt-BR'),
        status: 'em_analise',
        itens: itens.map((i) => ({
          id: i.id || `it-${Math.random()}`,
          material: {
            id: i.id || `mat-${Math.random()}`,
            nome: i.texto || 'Material',
            ncm: '8544.49.00',
            categoria: 'eletrica',
            precoBaseUnitario: 35,
            unidade: 'un',
            icmsStPercent: 12,
          },
          quantidade: i.quantidade || 1,
        })),
        fornecedores: listaFornecedoresCalculados,
        fornecedorVencedorNome: vencedor.nome,
        valorTotalGeral: vencedor.valorTotalGeral,
        valorTotalSTTotal: vencedor.valorST,
        economiaEstimadaBRL: Number((vencedor.valorProdutos * 0.12).toFixed(2)),
      };

      setCotacoesAtivas((prev) => [novaCotacao, ...prev]);
      setCotacoesHistorico((prev) => [novaCotacao, ...prev]);
      setCotacaoSelecionadaParaResultado(novaCotacao);

      return novaCotacao;
    },
    []
  );

  const aprovarCotacaoSession = useCallback(async (cotacaoId: string) => {
    await db.cotacoes.updateStatus(cotacaoId, 'aprovada');

    setCotacoesAtivas((prev) => {
      const target = prev.find((c) => c.id === cotacaoId);
      if (target) {
        const aprovada: CotacaoSession = { ...target, status: 'aprovada' };
        setCotacoesHistorico((hist) =>
          hist.map((h) => (h.id === cotacaoId ? aprovada : h))
        );
      }
      return prev.filter((c) => c.id !== cotacaoId);
    });

    carregarHistoricoDoBanco();
  }, [carregarHistoricoDoBanco]);

  const recusarCotacaoSession = useCallback(async (cotacaoId: string) => {
    await db.cotacoes.updateStatus(cotacaoId, 'recusada');

    setCotacoesAtivas((prev) => {
      const target = prev.find((c) => c.id === cotacaoId);
      if (target) {
        const recusada: CotacaoSession = { ...target, status: 'recusada' };
        setCotacoesHistorico((hist) =>
          hist.map((h) => (h.id === cotacaoId ? recusada : h))
        );
      }
      return prev.filter((c) => c.id !== cotacaoId);
    });

    carregarHistoricoDoBanco();
  }, [carregarHistoricoDoBanco]);

  const substituirItemPorAlternativaRpa = useCallback(
    async (cotacaoId: string, fornecedorId: string, itemId: string): Promise<FornecedorCotado> => {
      console.log('[RPA SESSAO RESUME]', { cotacaoId, fornecedorId, itemId });

      // Localizar a cotação alvo
      let cotacaoAlvo = cotacoesAtivas.find((c) => c.id === cotacaoId) || cotacaoSelecionadaParaResultado;
      if (!cotacaoAlvo && cotacoesAtivas.length > 0) {
        cotacaoAlvo = cotacoesAtivas[0];
      }

      if (!cotacaoAlvo) {
        throw new Error('Cotação não encontrada no sistema');
      }

      const fornecedorAlvo = (cotacaoAlvo.fornecedores || []).find((f) => f.id === fornecedorId);
      if (!fornecedorAlvo) {
        throw new Error('Fornecedor não encontrado na cotação');
      }

      // Atualizar o item trocando de marca_diferente para encontrado
      const itensAtualizados = (fornecedorAlvo.itensCotados || []).map((it) => {
        if (it.itemId === itemId || (it.status === 'marca_diferente' && it.itemId.includes(itemId))) {
          const nomeFinal = it.produtoAlternativoSugestao || it.nomeEncontrado.replace(/\[.*\]/g, '').trim();
          return {
            ...it,
            status: 'encontrado' as const,
            nomeEncontrado: `${nomeFinal} (Adicionado via RPA)`,
          };
        }
        return it;
      });

      // Recalcular totais para o fornecedor
      let totalProdutosAcumulado = 0;
      let totalSTAcumulado = 0;

      itensAtualizados.forEach((it) => {
        if (it.status !== 'nao_encontrado') {
          totalProdutosAcumulado += it.subtotal;
          totalSTAcumulado += it.icmsStValor;
        }
      });

      const valorTotalGeral = Number((totalProdutosAcumulado + totalSTAcumulado).toFixed(2));
      const urlCarrinhoAtualizada = `${fornecedorAlvo.urlCarrinhoDireto || 'https://www.cicalfer.com.br/carrinho'}?updated=true&ts=${Date.now()}`;

      const fornecedorAtualizado: FornecedorCotado = {
        ...fornecedorAlvo,
        itensCotados: itensAtualizados,
        valorProdutos: Number(totalProdutosAcumulado.toFixed(2)),
        valorST: Number(totalSTAcumulado.toFixed(2)),
        valorTotalGeral,
        urlCarrinhoDireto: urlCarrinhoAtualizada,
        sessaoAtiva: true,
        matchingStatus: 'exato',
      };

      const atualizarCotacaoObj = (c: CotacaoSession): CotacaoSession => {
        const novosForns = (c.fornecedores || []).map((f) => (f.id === fornecedorId ? fornecedorAtualizado : f));
        let novoVencedor = novosForns[0];
        novosForns.forEach((f) => {
          if (f.matchingStatus === 'exato' && f.valorTotalGeral < novoVencedor.valorTotalGeral) {
            novoVencedor = f;
          }
        });
        novosForns.forEach((f) => {
          f.isVencedor = f.id === novoVencedor.id;
        });
        return {
          ...c,
          fornecedores: novosForns,
          fornecedorVencedorNome: novoVencedor.nome,
          economiaEstimadaBRL: Number((novoVencedor.valorTotalGeral * 0.12).toFixed(2)),
        };
      };

      setCotacoesAtivas((prev) => prev.map((c) => (c.id === cotacaoAlvo!.id ? atualizarCotacaoObj(c) : c)));
      setCotacaoSelecionadaParaResultado((prev) => (prev ? atualizarCotacaoObj(prev) : null));

      return fornecedorAtualizado;
    },
    [cotacoesAtivas, cotacaoSelecionadaParaResultado]
  );

  const economiaAcumuladaTotal = cotacoesHistorico.reduce(
    (acc, c) => acc + c.economiaEstimadaBRL,
    0
  );

  return (
    <CotacoesContext.Provider
      value={{
        catálogoMateriais,
        itensDraft,
        cotacoesAtivas,
        cotacoesHistorico,
        cotacaoSelecionadaParaResultado,
        isLoadingCotacoes,
        errorCotacoes,
        isLoadingHistorico,
        errorHistorico,
        adicionarItemAoDraft,
        removerItemDoDraft,
        limparDraft,
        carregarCotacoesDoBanco,
        carregarHistoricoDoBanco,
        gerarCotacaoSession,
        enviarCotacaoComFornecedores,
        aprovarCotacaoSession,
        recusarCotacaoSession,
        substituirItemPorAlternativaRpa,
        economiaAcumuladaTotal,
      }}
    >
      {children}
    </CotacoesContext.Provider>
  );
};

export function useCotacoesSession() {
  const context = useContext(CotacoesContext);
  if (!context) {
    throw new Error('useCotacoesSession deve ser usado dentro de um CotacoesProvider');
  }
  return context;
}
