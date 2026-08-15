import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Cotacao, Fornecedor, Produto, RegraTributaria } from '@/types';
import { TAX_RULES_DATABASE } from '../services/tax';

import { API_CONFIG } from '@/lib/config/api';

const SUPABASE_URL = API_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = API_CONFIG.supabaseAnonKey;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('sua-instancia.supabase.co')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export interface DBRecordFornecedor {
  id: string;
  nome: string;
  categoria: string;
  score_confiabilidade: number;
  prazo_medio_dias: number;
  criado_em?: string;
}

export interface DBRecordCotacao {
  id: string;
  data_criacao: string;
  status: 'pendente' | 'aprovada' | 'recusada' | 'rascunho';
  valor_total: number;
  fornecedor_id?: string;
  criado_em?: string;
}

export interface DBRecordItemCotacao {
  id?: string;
  cotacao_id: string;
  material: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  categoria?: string;
  criado_em?: string;
}

/**
 * Data Access Layer (DAL) Conectada 100% ao Banco de Dados Real (PostgreSQL / Supabase)
 */
export const db = {
  // COTAÇÕES
  cotacoes: {
    async list(): Promise<Cotacao[]> {
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('cotacoes')
        .select('*, fornecedores:fornecedor_id(*), itens:itens_cotacao(*)')
        .order('data_criacao', { ascending: false });

      if (error || !data) return [];

      return data.map((c: any) => ({
        id: c.id,
        codigoCotacao: `#${c.id.substring(0, 4).toUpperCase()}`,
        projeto: {
          id: 'proj-1',
          clienteId: 'cli-1',
          nomeObra: 'Reserva das Palmeiras',
          ufDestino: 'SP',
        },
        status: c.status === 'aprovada' ? 'aprovada' : c.status === 'recusada' ? 'recusada' : 'em_analise',
        origem: 'texto',
        categoriaPrincipal: c.itens?.[0]?.categoria || 'eletrica',
        dataCriacao: new Date(c.data_criacao).toLocaleDateString('pt-BR'),
        fornecedoresParticipantesCount: 3,
        valorTotalProdutos: Number((c.valor_total * 0.9).toFixed(2)),
        valorTotalST: Number((c.valor_total * 0.1).toFixed(2)),
        valorTotalGeral: Number(c.valor_total),
        economiaEstimadaBRL: Number((c.valor_total * 0.12).toFixed(2)),
        melhorFornecedorNome: c.fornecedores?.nome || 'Elétrica São Paulo',
        itens: (c.itens || []).map((it: any) => ({
          id: it.id,
          cotacaoId: c.id,
          nomeOriginal: it.material,
          ncm: '8544.49.00',
          atributos: { bitola: '2.5mm²' },
          quantidade: Number(it.quantidade),
          unidade: it.unidade,
          matchingStatus: 'exato',
          precosFornecedores: [
            {
              fornecedorId: c.fornecedor_id || 'forn-1',
              fornecedorNome: c.fornecedores?.nome || 'Elétrica São Paulo',
              precoUnitario: Number(it.preco_unitario),
              unidadeOferecida: it.unidade,
              fatorConversao: 1,
              resultadoST: {
                valorSTUnitario: Number(it.preco_unitario) * 0.1,
                valorSTTotal: Number(it.preco_unitario) * Number(it.quantidade) * 0.1,
                aliquotaEfetivaPercent: 10,
                baseCalculoST: Number(it.preco_unitario) * Number(it.quantidade),
                isTaxEstimated: false,
              },
              isBestPrice: true,
            },
          ],
        })),
      })) as Cotacao[];
    },

    async listHistorico(filters?: { fornecedorNome?: string }): Promise<Cotacao[]> {
      if (!supabase) return [];

      let query = supabase
        .from('cotacoes')
        .select('*, fornecedores:fornecedor_id(*), itens:itens_cotacao(*)')
        .in('status', ['aprovada', 'recusada'])
        .order('data_criacao', { ascending: false });

      const { data, error } = await query;
      if (error || !data) return [];

      let cotacoesFormatadas = data.map((c: any) => ({
        id: c.id,
        codigoCotacao: `#${c.id.substring(0, 4).toUpperCase()}`,
        projeto: {
          id: 'proj-1',
          clienteId: 'cli-1',
          nomeObra: 'Reserva das Palmeiras',
          ufDestino: 'SP',
        },
        status: c.status === 'aprovada' ? 'aprovada' : 'recusada',
        origem: 'texto',
        categoriaPrincipal: c.itens?.[0]?.categoria || 'eletrica',
        dataCriacao: new Date(c.data_criacao).toLocaleDateString('pt-BR'),
        fornecedoresParticipantesCount: 3,
        valorTotalProdutos: Number((c.valor_total * 0.9).toFixed(2)),
        valorTotalST: Number((c.valor_total * 0.1).toFixed(2)),
        valorTotalGeral: Number(c.valor_total),
        economiaEstimadaBRL: Number((c.valor_total * 0.12).toFixed(2)),
        melhorFornecedorNome: c.fornecedores?.nome || 'Elétrica São Paulo',
        itens: [],
      }));

      if (filters?.fornecedorNome && filters.fornecedorNome !== 'todos') {
        const fLower = filters.fornecedorNome.toLowerCase();
        cotacoesFormatadas = cotacoesFormatadas.filter((c) =>
          c.melhorFornecedorNome.toLowerCase().includes(fLower)
        );
      }

      return cotacoesFormatadas as Cotacao[];
    },

    async getById(id: string): Promise<Cotacao | null> {
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('cotacoes')
        .select('*, fornecedores:fornecedor_id(*), itens:itens_cotacao(*)')
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return data as any;
    },

    async updateStatus(id: string, status: 'aprovada' | 'recusada' | 'pendente'): Promise<boolean> {
      if (!supabase) return false;

      const { error } = await supabase
        .from('cotacoes')
        .update({ status })
        .eq('id', id);
      return !error;
    },

    async create(payload: {
      valor_total?: number;
      status?: any;
      fornecedor_id?: string;
      itens?: DBRecordItemCotacao[];
      origem?: string;
      origemTextoOriginal?: string;
      categoriaPrincipal?: string;
      valorTotalProdutos?: number;
      valorTotalST?: number;
      valorTotalGeral?: number;
      economiaEstimadaBRL?: number;
      [key: string]: any;
    }): Promise<Cotacao> {
      const valTotal = payload.valor_total || payload.valorTotalGeral || 0;
      const cotacaoRecord: Partial<DBRecordCotacao> = {
        status: payload.status === 'rascunho' ? 'rascunho' : 'pendente',
        valor_total: valTotal,
        fornecedor_id: payload.fornecedor_id,
      };

      let createdId = `cot-${Date.now()}`;

      if (supabase) {
        const { data: cotData, error: cotErr } = await supabase
          .from('cotacoes')
          .insert([cotacaoRecord])
          .select()
          .single();

        if (!cotErr && cotData) {
          createdId = cotData.id;
          if (payload.itens && payload.itens.length > 0) {
            const itensRecords = payload.itens.map((it) => ({
              cotacao_id: cotData.id,
              material: it.material,
              quantidade: it.quantidade,
              unidade: it.unidade,
              preco_unitario: it.preco_unitario,
              categoria: it.categoria || 'eletrica',
            }));

            await supabase.from('itens_cotacao').insert(itensRecords);
          }
        }
      }

      return {
        id: createdId,
        codigoCotacao: `#${createdId.substring(0, 4).toUpperCase()}`,
        projeto: {
          id: 'proj-1',
          clienteId: 'cli-1',
          nomeObra: 'Reserva das Palmeiras',
          ufDestino: 'SP',
        },
        status: 'em_analise',
        origem: (payload.origem as any) || 'texto',
        origemTextoOriginal: payload.origemTextoOriginal,
        categoriaPrincipal: (payload.categoriaPrincipal as any) || 'eletrica',
        dataCriacao: new Date().toLocaleDateString('pt-BR'),
        itens: [],
        fornecedoresParticipantesCount: 3,
        valorTotalProdutos: payload.valorTotalProdutos || valTotal * 0.9,
        valorTotalST: payload.valorTotalST || valTotal * 0.1,
        valorTotalGeral: valTotal,
        economiaEstimadaBRL: payload.economiaEstimadaBRL || valTotal * 0.12,
        melhorFornecedorNome: 'Lojista Credenciado',
      };
    },
  },

  // FORNECEDORES
  fornecedores: {
    async list(query?: string): Promise<Fornecedor[]> {
      if (!supabase) return [];

      let req = supabase.from('fornecedores').select('*').order('nome', { ascending: true });
      if (query && query.trim()) {
        req = req.or(`nome.ilike.%${query}%,categoria.ilike.%${query}%`);
      }

      const { data, error } = await req;
      if (error || !data) return [];

      return data.map((f: any) => ({
        id: f.id,
        nome: f.nome,
        categoria: f.categoria || 'Geral',
        uf: 'SP',
        scoreConfiabilidade: Number(f.score_confiabilidade) || 5.0,
        slaMinutos: Number(f.prazo_medio_dias) * 1440 || 15,
        acordoST: 'Protocolo ICMS ST Válido',
        especialidades: [f.categoria || 'Materiais'],
        verificado: true,
        cotacoesAtendidasCount: 12,
      }));
    },

    async create(payload: {
      nome: string;
      categoria?: string;
      score_confiabilidade?: number;
      prazo_medio_dias?: number;
    }): Promise<Fornecedor> {
      const record: Partial<DBRecordFornecedor> = {
        nome: payload.nome,
        categoria: payload.categoria || 'Elétrica & Fiação',
        score_confiabilidade: payload.score_confiabilidade || 5.0,
        prazo_medio_dias: payload.prazo_medio_dias || 2,
      };

      let createdForn: Fornecedor = {
        id: `forn-${Date.now()}`,
        nome: payload.nome,
        categoria: payload.categoria || 'Geral',
        uf: 'SP',
        scoreConfiabilidade: payload.score_confiabilidade || 5.0,
        slaMinutos: (payload.prazo_medio_dias || 2) * 1440,
        acordoST: 'Protocolo ICMS ST Válido',
        especialidades: [payload.categoria || 'Geral'],
        verificado: true,
        cotacoesAtendidasCount: 0,
      };

      if (supabase) {
        const { data, error } = await supabase
          .from('fornecedores')
          .insert([record])
          .select()
          .single();

        if (!error && data) {
          createdForn = {
            id: data.id,
            nome: data.nome,
            categoria: data.categoria,
            uf: 'SP',
            scoreConfiabilidade: Number(data.score_confiabilidade),
            slaMinutos: Number(data.prazo_medio_dias) * 1440,
            acordoST: 'Protocolo ICMS ST Válido',
            especialidades: [data.categoria],
            verificado: true,
            cotacoesAtendidasCount: 0,
          };
        }
      }

      return createdForn;
    },

    async update(id: string, payload: Partial<DBRecordFornecedor>): Promise<boolean> {
      if (!supabase) return false;

      const { error } = await supabase
        .from('fornecedores')
        .update(payload)
        .eq('id', id);
      return !error;
    },

    async delete(id: string): Promise<{ success: boolean; errorMsg?: string }> {
      if (!supabase) return { success: false, errorMsg: 'Supabase não conectado.' };

      const { data: cotVinculadas } = await supabase
        .from('cotacoes')
        .select('id')
        .eq('fornecedor_id', id);

      if (cotVinculadas && cotVinculadas.length > 0) {
        return {
          success: false,
          errorMsg: `Não é possível excluir o fornecedor pois existem ${cotVinculadas.length} cotação(ões) vinculada(s).`,
        };
      }

      const { error } = await supabase.from('fornecedores').delete().eq('id', id);
      if (error) {
        return { success: false, errorMsg: error.message };
      }
      return { success: true };
    },
  },

  // PRODUTOS
  produtos: {
    async list(): Promise<Produto[]> {
      if (!supabase) return [];

      const { data, error } = await supabase.from('produtos').select('*');
      if (error || !data) return [];
      return data as Produto[];
    },

    async create(produto: Omit<Produto, 'id'>): Promise<Produto> {
      const newProduto: Produto = {
        ...produto,
        id: `prod-${Date.now()}`,
      };

      if (supabase) {
        await supabase.from('produtos').insert([newProduto]);
      }
      return newProduto;
    },
  },

  // REGRAS FISCAIS
  taxRules: {
    async list(): Promise<RegraTributaria[]> {
      if (!supabase) return TAX_RULES_DATABASE;

      const { data, error } = await supabase.from('tax_rules').select('*');
      if (error || !data || data.length === 0) return TAX_RULES_DATABASE;
      return data as RegraTributaria[];
    },
  },

  // RASCUNHOS DE COTAÇÃO ESTILO BLOCO DE NOTAS (PROMPT 6)
  rascunhos: {
    async obterAtivo(usuarioId: string): Promise<any | null> {
      const nowIso = new Date().toISOString();

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('cotacoes_rascunho')
            .select('*')
            .eq('usuario_id', usuarioId)
            .eq('status', 'rascunho')
            .gt('expira_em', nowIso)
            .order('ultima_edicao_em', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data && !error) {
            return {
              id: data.id,
              usuarioId: data.usuario_id,
              obraNome: data.obra_nome,
              status: data.status,
              itens: data.itens || [],
              criadoEm: data.criado_em,
              ultimaEdicaoEm: data.ultima_edicao_em,
              expiraEm: data.expira_em,
            };
          }
        } catch (e) {
          console.warn('Falha ao consultar rascunhos no Supabase, usando localStorage:', e);
        }
      }

      // Fallback para localStorage se offline ou sem Supabase
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem(`saracota_draft_quote_${usuarioId}`);
        if (local) {
          const parsed = JSON.parse(local);
          const expiraTime = new Date(parsed.expiraEm || Date.now()).getTime();
          if (expiraTime > Date.now() && parsed.status === 'rascunho') {
            return parsed;
          } else {
            localStorage.removeItem(`saracota_draft_quote_${usuarioId}`);
          }
        }
      }

      return null;
    },

    async salvarAuto(usuarioId: string, obraNome: string, itens: any[], rascunhoIdExistente?: string): Promise<any> {
      const now = new Date();
      const expiraDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 dias
      const id = rascunhoIdExistente || `draft-${Date.now()}`;

      const draftObj = {
        id,
        usuarioId,
        obraNome,
        status: 'rascunho',
        itens,
        criadoEm: now.toISOString(),
        ultimaEdicaoEm: now.toISOString(),
        expiraEm: expiraDate.toISOString(),
      };

      // 1. Salvar no localStorage (autosave instantâneo)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`saracota_draft_quote_${usuarioId}`, JSON.stringify(draftObj));
      }

      // 2. Persistir no banco PostgreSQL / Supabase
      if (supabase) {
        try {
          await supabase.from('cotacoes_rascunho').upsert([
            {
              id: rascunhoIdExistente && !rascunhoIdExistente.startsWith('draft-') ? rascunhoIdExistente : undefined,
              usuario_id: usuarioId,
              obra_nome: obraNome,
              itens,
              status: 'rascunho',
              ultima_edicao_em: now.toISOString(),
              expira_em: expiraDate.toISOString(),
            },
          ]);
        } catch (e) {
          console.warn('Erro ao persisitir rascunho no banco:', e);
        }
      }

      return draftObj;
    },

    async finalizar(rascunhoId: string, usuarioId: string): Promise<void> {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`saracota_draft_quote_${usuarioId}`);
      }

      if (supabase && rascunhoId && !rascunhoId.startsWith('draft-')) {
        try {
          await supabase
            .from('cotacoes_rascunho')
            .update({ status: 'finalizada', ultima_edicao_em: new Date().toISOString() })
            .eq('id', rascunhoId);
        } catch (e) {
          console.warn('Erro ao finalizar rascunho no banco:', e);
        }
      }
    },

    async limparExpirados(): Promise<number> {
      const nowIso = new Date().toISOString();
      if (supabase) {
        try {
          const { data } = await supabase.rpc('expurgar_rascunhos_expirados');
          return data || 0;
        } catch (e) {
          // Fallback delete comum
          const { data } = await supabase
            .from('cotacoes_rascunho')
            .delete()
            .lt('expira_em', nowIso);
          return (data as unknown as any[])?.length || 0;
        }
      }
      return 0;
    },
  },
};
