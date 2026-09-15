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
  status: 'encontrado' | 'nao_encontrado' | 'marca_diferente' | 'similar' | 'processando';
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
  const [usuarioId] = useState<string>('61ab64e4-c2cb-46df-bb14-6cc326293085');
  const [catálogoMateriais, setCatálogoMateriais] = useState<ItemMaterialCatalog[]>(CATALOGO_BASE_MATERIAIS);
  const [itensDraft, setItensDraft] = useState<ItemCotacaoSelecionado[]>([]);

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
      const cotacoesFormatadas: CotacaoSession[] = listaDb.map((c: any) => {
        const itensFornReal = c.itens_cotacao_fornecedor || [];
        const sessaoReal = c.cotacao_fornecedor_sessoes?.[0];
        const cartUrl = sessaoReal?.browserbase_session_id?.startsWith('http') ? sessaoReal.browserbase_session_id : 'https://www.cicalfer.com.br/carrinho';

        // Itens cotados detalhados para o fornecedor Cicalfer
        const itensDetalhados: ItemCotadoDetalhado[] = (itensFornReal.length > 0 ? itensFornReal : c.itens || []).map((it: any, idx: number) => {
          let obs: any = {};
          if (it.observacoes && typeof it.observacoes === 'string' && it.observacoes.startsWith('{')) {
            try { obs = JSON.parse(it.observacoes); } catch (e) {}
          }
          const nomeProd = it.produto_encontrado || it.nome || obs.produtoEncontrado || it.material || it.nomeOriginal || `Produto ${idx + 1}`;
          const precoUnit = Number(it.preco_unitario || it.preco || obs.preco_unitario || it.precosFornecedores?.[0]?.precoUnitario || 0);
          const qtd = Number(it.quantidade || obs.quantidade || 1);
          const sub = Number((precoUnit * qtd).toFixed(2));
          const matchStatStr = it.status_matching || it.status || obs.status || 'CONFIRMADO';
          const isEncontrado = matchStatStr === 'CONFIRMADO' || matchStatStr === 'exato' || matchStatStr === 'encontrado' || precoUnit > 0;

          return {
            itemId: it.id || `it-det-${idx}`,
            nomeSolicitado: obs.itemPedido || it.material || it.nomeOriginal || nomeProd,
            nomeEncontrado: nomeProd,
            quantidade: qtd,
            unidade: it.unidade || 'unidades',
            precoUnitario: precoUnit,
            subtotal: sub,
            icmsStPercent: 0,
            icmsStValor: 0,
            subtotalComSt: sub,
            status: isEncontrado ? 'encontrado' : 'nao_encontrado',
          };
        });

        const totalCalculado = itensDetalhados.reduce((acc, item) => acc + item.subtotal, 0);
        const valorGeralFinal = totalCalculado > 0 ? totalCalculado : Number(c.valorTotalGeral || c.valor_total || 0);

        const fornecedorReal: FornecedorCotado = {
          id: '33e03495-100d-45a3-9e34-899de56b0ab1',
          nome: 'Cicalfer Material Elétrico',
          score: 5.0,
          fatorPreco: 1.0,
          prazoDias: 1,
          matchingStatus: 'exato',
          valorProdutos: Number(valorGeralFinal.toFixed(2)),
          valorST: 0,
          valorTotalGeral: Number(valorGeralFinal.toFixed(2)),
          isVencedor: true,
          urlCarrinhoDireto: cartUrl,
          itensCotados: itensDetalhados,
        };

        return {
          id: c.id,
          codigo: c.codigoCotacao || `#${(c.id || '').substring(0, 4).toUpperCase()}`,
          obra: c.projeto?.nomeObra || c.obraNome || 'Reserva das Palmeiras',
          categoriaPrincipal: c.categoriaPrincipal || 'eletrica',
          dataCriacao: c.dataCriacao || 'Hoje',
          status: c.status === 'aprovada' ? 'aprovada' : c.status === 'recusada' ? 'recusada' : 'em_analise',
          itens: (c.itens || []).map((it: any, idx: number) => {
            const itemMatch = itensDetalhados[idx] || itensDetalhados[0];
            return {
              id: it.id || `it-${idx}`,
              material: {
                id: it.produtoId || `mat-${idx}`,
                nome: itemMatch ? itemMatch.nomeEncontrado : (it.nomeOriginal || 'Material'),
                ncm: it.ncm || '8544.49.00',
                categoria: 'eletrica' as const,
                precoBaseUnitario: itemMatch ? itemMatch.precoUnitario : (it.precosFornecedores?.[0]?.precoUnitario || 10),
                unidade: it.unidade || 'unidades',
                icmsStPercent: 0,
              },
              quantidade: Number(it.quantidade || 1),
            };
          }),
          fornecedores: [fornecedorReal],
          fornecedorVencedorNome: 'Cicalfer Material Elétrico',
          valorTotalGeral: Number(valorGeralFinal.toFixed(2)),
          valorTotalSTTotal: 0,
          economiaEstimadaBRL: Number((valorGeralFinal * 0.12).toFixed(2)),
        };
      });

      // Consultar primeiro a tabela/módulo cotacoes_ativas (persistência viva de cards por fornecedor)
      const ativasDb = await db.cotacoesAtivas.listar(usuarioId, 'Reserva das Palmeiras');

      if (ativasDb && ativasDb.length > 0) {
        const fornListAtivos: FornecedorCotado[] = ativasDb.map((rec) => {
          const itensDet: ItemCotadoDetalhado[] = (rec.itens || []).map((it: any, idx: number) => {
            const unitPrice = Number(it.precoUnitario || it.preco_unitario || 0);
            const qtd = Number(it.quantidade || it.qtd || 1);
            const sub = Number(it.precoTotal || (unitPrice * qtd).toFixed(2));
            return {
              itemId: it.itemId || `it-act-${idx}`,
              nomeSolicitado: it.nomeSolicitado || it.nome || 'Produto',
              nomeEncontrado: it.nomeEncontrado || it.nome || 'Produto',
              quantidade: qtd,
              unidade: it.unidade || 'un',
              precoUnitario: unitPrice,
              subtotal: sub,
              icmsStPercent: 0,
              icmsStValor: 0,
              subtotalComSt: sub,
              status: 'encontrado',
            };
          });

          return {
            id: rec.fornecedor_id,
            nome: rec.fornecedor_nome,
            score: 5.0,
            fatorPreco: 1.0,
            prazoDias: 1,
            matchingStatus: 'exato',
            valorProdutos: rec.valor_total,
            valorST: 0,
            valorTotalGeral: rec.valor_total,
            isVencedor: true,
            urlCarrinhoDireto: 'https://www.cicalfer.com.br/carrinho',
            itensCotados: itensDet,
          };
        });

        const cotacaoConsolidada: CotacaoSession = {
          id: ativasDb[0].id || 'cot-act-main',
          codigo: `#${(ativasDb[0].id || 'ACT').substring(0, 4).toUpperCase()}`,
          obra: ativasDb[0].obra_id || 'Reserva das Palmeiras',
          categoriaPrincipal: 'eletrica',
          dataCriacao: 'Ativa no Banco',
          status: 'em_analise',
          itens: [],
          fornecedores: fornListAtivos,
          fornecedorVencedorNome: fornListAtivos[0]?.nome || 'Cicalfer Material Elétrico',
          valorTotalGeral: fornListAtivos[0]?.valorTotalGeral || 0,
          valorTotalSTTotal: 0,
          economiaEstimadaBRL: Number(((fornListAtivos[0]?.valorTotalGeral || 0) * 0.12).toFixed(2)),
        };

        setCotacoesAtivas([cotacaoConsolidada]);
        setCotacaoSelecionadaParaResultado(cotacaoConsolidada);
      } else {
        // Fallback se ainda não houver cotacoes_ativas gravadas
        const cotacoesSomenteAtivas = cotacoesFormatadas.filter((c) => {
          const isStatusAtivo = c.status === 'em_analise' || (c as any).status === 'pendente';
          const isStatusInativo = c.status === 'aprovada' || c.status === 'recusada' || (c as any).status === 'finalizada';

          const temItens = c.itens && c.itens.length > 0;
          const temItensForn = c.fornecedores?.some((f) => f.itensCotados && f.itensCotados.length > 0);
          const isGhost = c.valorTotalGeral === 0 && !temItens && !temItensForn;

          return isStatusAtivo && !isStatusInativo && !isGhost;
        });

        setCotacoesAtivas(cotacoesSomenteAtivas);
        if (cotacoesSomenteAtivas.length > 0) {
          setCotacaoSelecionadaParaResultado(cotacoesSomenteAtivas[0]);
        }
      }
    } catch (err: any) {
      setErrorCotacoes(err.message || 'Erro ao carregar cotações do banco de dados.');
    } finally {
      setIsLoadingCotacoes(false);
    }
  }, [usuarioId]);

  /**
   * Buscar Histórico de Cotações no Banco Real
   */
  const carregarHistoricoDoBanco = useCallback(async (fornecedorFiltro?: string) => {
    setIsLoadingHistorico(true);
    setErrorHistorico(null);
    try {
      const listaHist = await db.historico.listar(usuarioId);
      const cotacoesFormatadas: CotacaoSession[] = listaHist
        .filter((h) => {
          if (!fornecedorFiltro || fornecedorFiltro === 'todos') return true;
          return h.fornecedor.toLowerCase().includes(fornecedorFiltro.toLowerCase());
        })
        .map((c) => ({
          id: c.id,
          codigo: `#${c.id.substring(0, 4).toUpperCase()}`,
          obra: c.obra_nome,
          categoriaPrincipal: 'eletrica',
          dataCriacao: new Date(c.criado_em).toLocaleDateString('pt-BR') + ' ' + new Date(c.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'aprovada',
          itens: (c.itens || []).map((it: any, idx: number) => ({
            id: `h-item-${idx}`,
            material: {
              id: `m-h-${idx}`,
              nome: it.nome || it.nomeSolicitado || 'Material',
              ncm: '8544.49.00',
              unidade: it.unidade || 'un',
              categoria: 'eletrica',
              precoBaseUnitario: Number(it.precoUnitario || 0),
              icmsStPercent: 0,
            },
            quantidade: Number(it.qtd || it.quantidade || 1),
          })),
          fornecedores: [
            {
              id: `f-${c.id}`,
              nome: c.fornecedor,
              score: 5.0,
              fatorPreco: 1.0,
              prazoDias: 2,
              matchingStatus: 'exato',
              valorProdutos: c.valor_total,
              valorST: 0,
              valorTotalGeral: c.valor_total,
              urlCarrinhoDireto: 'https://www.cicalfer.com.br/carrinho',
              itensCotados: (c.itens || []).map((it: any, idx: number) => ({
                itemId: `hist-item-${idx}`,
                nomeSolicitado: it.nome || it.nomeSolicitado || 'Item',
                nomeEncontrado: it.nome || it.nomeEncontrado || 'Item',
                quantidade: Number(it.qtd || it.quantidade || 1),
                unidade: it.unidade || 'un',
                precoUnitario: Number(it.precoUnitario || 0),
                subtotalComSt: Number(it.precoTotal || (Number(it.precoUnitario || 0) * Number(it.qtd || 1))),
                status: 'encontrado',
              })),
            },
          ],
          fornecedorVencedorNome: c.fornecedor,
          valorTotalGeral: c.valor_total,
          valorTotalSTTotal: 0,
          economiaEstimadaBRL: Number((c.valor_total * 0.12).toFixed(2)),
        }));

      setCotacoesHistorico(cotacoesFormatadas);
    } catch (err: any) {
      setErrorHistorico(err.message || 'Erro ao carregar histórico do banco de dados.');
    } finally {
      setIsLoadingHistorico(false);
    }
  }, [usuarioId]);

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

      try {
        await db.historico.salvar({
          user_id: usuarioId,
          obra_nome: obraNome || 'Reserva das Palmeiras',
          fornecedor: 'Elétrica São Paulo',
          itens: itens.map((i) => ({
            nome: i.material.nome,
            ref: '',
            qtd: i.quantidade,
            unidade: i.material.unidade,
            precoUnitario: i.material.precoBaseUnitario,
            precoTotal: Number((i.material.precoBaseUnitario * i.quantidade).toFixed(2)),
          })),
          valor_total: valorTotalGeralCalculado,
          quantidade_itens: itens.length,
        });

        await db.cotacoesAtivas.upsert({
          user_id: usuarioId,
          obra_id: obraNome || 'Reserva das Palmeiras',
          fornecedor_id: 'forn-sim-1',
          fornecedor_nome: 'Elétrica São Paulo',
          itens: itens.map((i) => ({
            nomeSolicitado: i.material.nome,
            nomeEncontrado: i.material.nome,
            ref: '',
            qtd: i.quantidade,
            unidade: i.material.unidade,
            precoUnitario: i.material.precoBaseUnitario,
            precoTotal: Number((i.material.precoBaseUnitario * i.quantidade).toFixed(2)),
          })),
          valor_total: valorTotalGeralCalculado,
        });
      } catch (eHist) {
        console.warn('Aviso ao salvar histórico e cotação ativa em gerarCotacaoSession:', eHist);
      }

      setCotacaoSelecionadaParaResultado(novaCotacao);

      return novaCotacao;
    },
    [itensDraft, catálogoMateriais, usuarioId]
  );

  const enviarCotacaoComFornecedores = useCallback(
    async (obraNome: string, itens: any[], fornecedorIds: string[]): Promise<CotacaoSession> => {
      const fornecedoresDB = await db.fornecedores.list();

      // URLs de carrinho direto conhecidas por fornecedor (atualizadas pelo robô RPA)
      const cartUrlsFornecedor: Record<string, string> = {
        '33e03495-100d-45a3-9e34-899de56b0ab1': 'https://www.cicalfer.com.br/carrinho',
        'forn-cicalfer': 'https://www.cicalfer.com.br/carrinho',
      };

      const listaFornecedoresCalculados: FornecedorCotado[] = fornecedorIds.map((fId) => {
        const fornDb = fornecedoresDB.find((f) => f.id === fId);
        const fornNome = fornDb?.nome || `Lojista Credenciado (${fId.substring(0, 6)})`;
        const fornWa = fornDb?.whatsapp || '(11) 98765-4321';
        const fornCategoria = fornDb?.categoria || 'GERAL';

        const itensCotados: ItemCotadoDetalhado[] = itens.map((itemInput, idx) => {
          const rawText = itemInput.texto || itemInput.material?.nome || 'Material';
          const quantidade = itemInput.quantidade && itemInput.quantidade > 0 ? itemInput.quantidade : 1;
          const nomeLimpo = rawText.replace(/^\d+x\s*/i, '').trim();

          return {
            itemId: itemInput.id || `it-${idx}`,
            nomeSolicitado: rawText,
            nomeEncontrado: `${nomeLimpo} (Aguardando resultado RPA)`,
            quantidade,
            unidade: 'un',
            precoUnitario: 0,
            subtotal: 0,
            icmsStPercent: 0,
            icmsStValor: 0,
            subtotalComSt: 0,
            status: 'processando',
          };
        });

        const capturedUrl = cartUrlsFornecedor[fId] || cartUrlsFornecedor[fId.replace(/^forn-/, '')];
        const cartUrlResult = resolveSupplierCartUrl({
          capturedUrl,
          officialPortalUrl: (fornDb as any)?.urlPortalB2B || (fornDb as any)?.url_site,
          supplierName: fornNome,
          supplierId: fId,
        });
        const cartUrl = cartUrlResult.url;
        const sessaoValidaAte = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        return {
          id: fId,
          nome: fornNome,
          score: 4.8,
          fatorPreco: 1.0,
          prazoDias: 2,
          matchingStatus: 'exato',
          valorProdutos: 0,
          valorST: 0,
          valorTotalGeral: 0,
          whatsapp: fornWa,
          categoria: fornCategoria,
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
        fornecedor_id: fornecedorIds[0],
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

      setCotacoesAtivas((prev) => [novaCotacao, ...prev.filter((c) => c.id !== novaCotacao.id)]);
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
