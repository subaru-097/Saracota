'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/db/client';

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
  aprovarCotacaoSession: (cotacaoId: string) => Promise<void>;
  recusarCotacaoSession: (cotacaoId: string) => Promise<void>;
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

  const aprovarCotacaoSession = useCallback(async (cotacaoId: string) => {
    await db.cotacoes.updateStatus(cotacaoId, 'aprovada');

    setCotacoesAtivas((prev) => {
      const target = prev.find((c) => c.id === cotacaoId);
      if (target) {
        const aprovada: CotacaoSession = { ...target, status: 'aprovada' };
        setCotacoesHistorico((hist) => [aprovada, ...hist]);
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
        setCotacoesHistorico((hist) => [recusada, ...hist]);
      }
      return prev.filter((c) => c.id !== cotacaoId);
    });

    carregarHistoricoDoBanco();
  }, [carregarHistoricoDoBanco]);

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
        aprovarCotacaoSession,
        recusarCotacaoSession,
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
