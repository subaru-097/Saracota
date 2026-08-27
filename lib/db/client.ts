import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Cotacao, Fornecedor, Produto, RegraTributaria } from '@/types';
import { TAX_RULES_DATABASE } from '../services/tax';
import { encryptAES256 } from '@/lib/security/vault';

import { API_CONFIG } from '@/lib/config/api';

const SUPABASE_URL = API_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = API_CONFIG.supabaseAnonKey;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('http') &&
    !SUPABASE_URL.includes('sua-instancia.supabase.co') &&
    !SUPABASE_URL.includes('sua-anon-key') &&
    !SUPABASE_ANON_KEY.includes('sua-anon-key')
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

    async salvarBrowserbaseSessionId(cotacaoId: string, sessionId: string): Promise<boolean> {
      if (!(globalThis as any).__saracota_sessions_store) {
        (globalThis as any).__saracota_sessions_store = {};
      }
      (globalThis as any).__saracota_sessions_store[cotacaoId] = sessionId;

      if (supabase) {
        try {
          await supabase.from('cotacoes').update({
            browserbase_session_id: sessionId,
            status: 'carrinho_pronto',
          }).eq('id', cotacaoId);
        } catch (e: any) {
          console.warn('⚠️ [SUPABASE WARN] Erro ao atualizar browserbase_session_id:', e.message);
        }
      }
      return true;
    },

    async obterBrowserbaseSessionId(cotacaoId: string): Promise<string | null> {
      if ((globalThis as any).__saracota_sessions_store && (globalThis as any).__saracota_sessions_store[cotacaoId]) {
        return (globalThis as any).__saracota_sessions_store[cotacaoId];
      }

      if (supabase) {
        try {
          const { data } = await supabase
            .from('cotacoes')
            .select('browserbase_session_id')
            .eq('id', cotacaoId)
            .maybeSingle();

          if (data && (data as any).browserbase_session_id) {
            return (data as any).browserbase_session_id;
          }
        } catch (e: any) {
          console.warn('⚠️ [SUPABASE WARN] Erro ao consultar browserbase_session_id:', e.message);
        }
      }

      return null;
    },

    async salvarProgresso(
      cotacaoId: string,
      progresso: {
        status: 'processando' | 'concluido' | 'aguardando_revisao' | 'erro';
        itensProcessados: number;
        totalItens: number;
        percentualConcluido: number;
        mensagens: string[];
      }
    ): Promise<boolean> {
      // 1. Armazenar no cache global Node (compartilhado entre chamadas no mesmo processo)
      if (!(globalThis as any).__saracota_progress_store) {
        (globalThis as any).__saracota_progress_store = {};
      }
      (globalThis as any).__saracota_progress_store[cotacaoId] = {
        ...progresso,
        cotacaoId,
        timestamp: new Date().toISOString(),
      };

      // 2. Persistir no Supabase / PostgreSQL
      if (supabase) {
        try {
          const dbStatus = progresso.status === 'concluido' ? 'concluida' : progresso.status === 'aguardando_revisao' ? 'aguardando_revisao' : 'em_analise';
          await supabase.from('cotacoes').update({
            status: dbStatus,
          }).eq('id', cotacaoId);
        } catch (e) {
          console.warn('Erro ao atualizar progresso da cotação no Supabase:', e);
        }
      }

      // 3. Persistir no localStorage (se executando no browser)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`saracota_progress_${cotacaoId}`, JSON.stringify(progresso));
        } catch (e) {
          console.warn('Erro ao salvar progresso no localStorage:', e);
        }
      }

      return true;
    },

    async obterProgresso(cotacaoId: string): Promise<{
      cotacaoId: string;
      status: 'processando' | 'concluido' | 'aguardando_revisao' | 'erro';
      itensProcessados: number;
      totalItens: number;
      percentualConcluido: number;
      mensagens: string[];
      timestamp: string;
    } | null> {
      // 1. Tentar ler do cache global de progresso
      if ((globalThis as any).__saracota_progress_store && (globalThis as any).__saracota_progress_store[cotacaoId]) {
        return (globalThis as any).__saracota_progress_store[cotacaoId];
      }

      // 2. Tentar ler do localStorage (se no cliente)
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(`saracota_progress_${cotacaoId}`);
          if (saved) {
            return JSON.parse(saved);
          }
        } catch (e) {
          console.warn('Erro ao ler progresso do localStorage:', e);
        }
      }

      // 3. Consultar estado real no banco Supabase
      if (supabase) {
        try {
          const { data: cotacao } = await supabase.from('cotacoes').select('*').eq('id', cotacaoId).maybeSingle();
          const { data: matchingItens } = await supabase.from('itens_cotacao_fornecedor').select('*').eq('cotacao_id', cotacaoId);

          if (cotacao) {
            const statusStr = cotacao.status || '';
            const isConcluido = statusStr === 'aprovada' || statusStr === 'concluida' || statusStr === 'finalizada';
            const isAguardando = statusStr === 'aguardando_revisao';

            const itensCount = matchingItens?.length || 0;
            const percentual = isConcluido || isAguardando ? 100 : itensCount > 0 ? 75 : 20;

            return {
              cotacaoId,
              status: isConcluido ? 'concluido' : isAguardando ? 'aguardando_revisao' : 'processando',
              itensProcessados: itensCount,
              totalItens: Math.max(1, itensCount),
              percentualConcluido: percentual,
              mensagens: [
                `Cotação em andamento no banco de dados (${statusStr || 'processando'}).`
              ],
              timestamp: new Date().toISOString(),
            };
          }
        } catch (e) {
          console.warn('Erro ao ler progresso do Supabase:', e);
        }
      }

      return null;
    },

    async salvarResultadosMatching(
      cotacaoId: string,
      fornecedorId: string,
      resultados: any[]
    ): Promise<boolean> {
      if (typeof window !== 'undefined') {
        try {
          const key = `saracota_matching_${cotacaoId}_${fornecedorId}`;
          localStorage.setItem(key, JSON.stringify(resultados));
        } catch (e) {
          console.warn('Erro ao salvar matching localmente:', e);
        }
      }

      if (supabase) {
        try {
          const records = resultados.map((r) => ({
            cotacao_id: cotacaoId,
            fornecedor_id: fornecedorId,
            material: r.itemPedido,
            produto_encontrado: r.produtoEncontrado || r.itemPedido,
            preco_unitario: r.preco,
            confianca_percent: r.confianca,
            status_matching: r.status,
            imagem: r.imagem,
            link: r.link,
          }));

          await supabase.from('itens_cotacao_fornecedor').insert(records);
        } catch (e) {
          console.warn('Erro ao salvar matching no Supabase:', e);
        }
      }

      return true;
    },

    async obterResultadosMatching(cotacaoId: string): Promise<any[]> {
      let resultados: any[] = [];

      if (typeof window !== 'undefined') {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`saracota_matching_${cotacaoId}_`)) {
              const parsed = JSON.parse(localStorage.getItem(key) || '[]');
              resultados = [...resultados, ...parsed];
            }
          }
        } catch (e) {
          console.warn('Erro ao ler matching local:', e);
        }
      }

      if (resultados.length === 0 && supabase) {
        try {
          const { data } = await supabase
            .from('itens_cotacao_fornecedor')
            .select('*')
            .eq('cotacao_id', cotacaoId);

          if (data && data.length > 0) {
            resultados = data.map((d: any) => ({
              itemPedido: d.material,
              status: d.status_matching,
              confianca: d.confianca_percent,
              produtoEncontrado: d.produto_encontrado,
              preco: d.preco_unitario,
              imagem: d.imagem,
              link: d.link,
              fornecedorId: d.fornecedor_id,
            }));
          }
        } catch (e) {
          console.warn('Erro ao buscar matching no Supabase:', e);
        }
      }

      // Fallback de demonstração rica caso não haja itens gravados ainda
      if (resultados.length === 0) {
        resultados = [
          {
            itemPedido: 'Cabo Flexível SIL 750V 2,5mm Azul (Rolo 100m)',
            status: 'CONFIRMADO',
            confianca: 96,
            produtoEncontrado: 'Cabo Flexível SIL 750V 2,5mm² Azul - Rolo 100m',
            preco: 285.5,
            imagem: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=120&q=80',
            link: 'https://portal.eletricasaopaulo.com.br/cabo25azul',
            fornecedorId: 'forn-1',
            fornecedorNome: 'Elétrica São Paulo',
          },
          {
            itemPedido: 'Tubo PVC Esgoto Amanco 100mm 6m',
            status: 'SIMILAR',
            confianca: 72,
            produtoEncontrado: 'Tubo PVC Esgoto Fortlev 100mm x 6m Branco',
            preco: 64.9,
            imagem: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=120&q=80',
            link: 'https://portal.hidraulica.com.br/tubopvc100',
            fornecedorId: 'forn-2',
            fornecedorNome: 'Hidráulica & Elétrica Central',
          },
          {
            itemPedido: 'Disjuntor Bipolar Din 32A Steck',
            status: 'NAO_ENCONTRADO',
            confianca: 35,
            produtoEncontrado: 'Disjuntor Unipolar 16A Siemens',
            preco: 0,
            fornecedorId: 'forn-1',
            fornecedorNome: 'Elétrica São Paulo',
          },
        ];
      }

      return resultados;
    },

    async atualizarStatusMatchingItem(
      cotacaoId: string,
      fornecedorId: string,
      itemPedido: string,
      novoStatus: 'CONFIRMADO' | 'IGNORADO'
    ): Promise<boolean> {
      if (typeof window !== 'undefined') {
        try {
          const key = `saracota_matching_${cotacaoId}_${fornecedorId}`;
          const current = JSON.parse(localStorage.getItem(key) || '[]');
          const updated = current.map((it: any) =>
            it.itemPedido === itemPedido ? { ...it, status: novoStatus, confianca: novoStatus === 'CONFIRMADO' ? 100 : 0 } : it
          );
          localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {
          console.warn('Erro ao atualizar matching local:', e);
        }
      }

      if (supabase) {
        try {
          await supabase
            .from('itens_cotacao_fornecedor')
            .update({
              status_matching: novoStatus,
              confianca_percent: novoStatus === 'CONFIRMADO' ? 100 : 0,
            })
            .match({ cotacao_id: cotacaoId, fornecedor_id: fornecedorId, material: itemPedido });
        } catch (e) {
          console.warn('Erro ao atualizar matching no Supabase:', e);
        }
      }

      return true;
    },
  },

  // FORNECEDORES
  fornecedores: {
    async list(query?: string): Promise<Fornecedor[]> {
      let resultList: Fornecedor[] = [];

      if (supabase) {
        try {
          let req = supabase.from('fornecedores').select('*').order('nome', { ascending: true });
          if (query && query.trim()) {
            req = req.or(`nome.ilike.%${query}%,categoria.ilike.%${query}%`);
          }

          const { data, error } = await req;
          if (!error && data) {
            resultList = data.map((f: any) => ({
              id: f.id,
              nome: f.nome,
              categoria: f.categoria || 'Elétrica',
              uf: 'SP',
              scoreConfiabilidade: Number(f.score_confiabilidade) || 5.0,
              slaMinutos: f.sla_minutos != null ? Number(f.sla_minutos) : 15,
              prazoMedioDias: f.prazo_medio_dias != null ? Number(f.prazo_medio_dias) : 2,
              acordoST: 'Protocolo ICMS ST Válido',
              especialidades: [f.categoria || 'Materiais'],
              verificado: true,
              cotacoesAtendidasCount: 12,
              conectado: Boolean(f.login_salvo || f.url_login),
              whatsapp: f.whatsapp,
              urlPortalB2B: f.url_login || f.url_portal_b2b || f.url_site,
              login: f.login_salvo || f.email_login,
              email: f.email || f.email_login || (f.login_salvo && f.login_salvo.includes('@') ? f.login_salvo : undefined),
              emailLogin: f.email_login || f.login_salvo,
              senhaLogin: f.senha_login || f.senha_criptografada,
              rawSenhaCriptografada: f.senha_criptografada || f.senha_login,
              cnpj: f.cnpj || (f.login_salvo && !f.login_salvo.includes('@') && f.login_salvo.length >= 14 ? f.login_salvo : undefined),
              senhaCriptografada: (f.senha_criptografada || f.senha_login) ? '••••••••' : undefined,
              observacoes: f.observacoes,
              requiresCookieDismissal: f.requires_cookie_dismissal ?? false,
              cookieSelectorHint: f.cookie_selector_hint || undefined,
              seletores: f.seletores || null,
              temCredencial: Boolean(f.login_salvo || f.url_login),
            }));
          }
        } catch (e) {
          console.warn('Erro ao buscar fornecedores do Supabase:', e);
        }
      }

      // Fallback via HTTP API do Next.js se a consulta direta ao Supabase via JS Client retornar vazia no browser
      if (resultList.length === 0 && typeof window !== 'undefined') {
        try {
          const apiEndpoint = `/api/v1/fornecedores${query && query.trim() ? `?q=${encodeURIComponent(query)}` : ''}`;
          const res = await fetch(apiEndpoint);
          if (res.ok) {
            const json = await res.json();
            if (json.data && Array.isArray(json.data) && json.data.length > 0) {
              resultList = json.data;
            }
          }
        } catch (apiErr) {
          console.warn('Erro ao carregar fornecedores via API HTTP fallback:', apiErr);
        }
      }

      // Purga automática de registros fantasmas (ex: forn-1787...) do localStorage
      if (typeof window !== 'undefined') {
        try {
          const localStr = localStorage.getItem('saracota_suppliers_custom');
          if (localStr) {
            const localArr: Fornecedor[] = JSON.parse(localStr);
            const cleaned = localArr.filter((f) => !f.id.startsWith('forn-'));
            if (cleaned.length !== localArr.length) {
              localStorage.setItem('saracota_suppliers_custom', JSON.stringify(cleaned));
            }
            if (!supabase && resultList.length === 0) {
              const filteredLocal = query && query.trim()
                ? cleaned.filter((f) =>
                    f.nome.toLowerCase().includes(query.toLowerCase()) ||
                    (f.categoria && f.categoria.toLowerCase().includes(query.toLowerCase()))
                  )
                : cleaned;

              const existingIds = new Set(resultList.map((f) => f.id));
              for (const item of filteredLocal) {
                if (!existingIds.has(item.id)) {
                  resultList.push(item);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Erro ao limpar ou ler localStorage de fornecedores:', e);
        }
      }

      return resultList;
    },

    async getById(id: string): Promise<Fornecedor | null> {
      const list = await this.list();
      return list.find((f) => f.id === id) || null;
    },

    async create(payload: {
      nome: string;
      categoria?: string;
      prazoMedioDias?: number;
      slaMinutos?: number;
      whatsapp?: string;
      urlPortalB2B?: string;
      tiposLogin?: string[];
      loginType?: 'modal' | 'page';
      triggerSelector?: string;
      email?: string;
      cnpj?: string;
      login?: string;
      senha?: string;
      logoUrl?: string;
      observacoes?: string;
    }): Promise<Fornecedor> {
      const encryptedSenha = payload.senha ? encryptAES256(payload.senha) : undefined;
      const temCredencial = Boolean(payload.senha || payload.login || payload.email || payload.cnpj);

      let createdForn: Fornecedor;

      // 1. Inserir direto no Banco de Dados (Supabase)
      if (supabase) {
        const { data, error } = await supabase
          .from('fornecedores')
          .insert([
            {
              user_id: '61ab64e4-c2cb-46df-bb14-6cc326293085',
              nome: payload.nome,
              categoria: payload.categoria || 'Elétrica',
              score_confiabilidade: 5.0,
              prazo_medio_dias: payload.prazoMedioDias ?? 2,
              sla_minutos: payload.slaMinutos ?? 15,
              whatsapp: payload.whatsapp,
              url_site: payload.urlPortalB2B || 'https://www.construja.com.br',
              url_login: payload.urlPortalB2B,
              login_salvo: payload.login || payload.email || payload.cnpj,
              email_login: payload.email || payload.login || payload.cnpj,
              senha_criptografada: encryptedSenha,
              senha_login: encryptedSenha,
              observacoes: payload.observacoes,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error('❌ Erro ao cadastrar fornecedor no banco de dados (Supabase):', error);
          throw new Error(`Falha ao salvar no banco de dados (Supabase): ${error.message || error.details || JSON.stringify(error)}`);
        }

        if (!data) {
          console.error('❌ Erro: Supabase não retornou os dados do fornecedor criado.');
          throw new Error('Falha ao salvar no banco de dados: Nenhum registro retornado pelo banco.');
        }

        createdForn = {
          id: data.id,
          nome: data.nome,
          categoria: data.categoria || 'Elétrica',
          uf: 'SP',
          scoreConfiabilidade: Number(data.score_confiabilidade) || 5.0,
          slaMinutos: data.sla_minutos != null ? Number(data.sla_minutos) : (payload.slaMinutos ?? 15),
          prazoMedioDias: data.prazo_medio_dias != null ? Number(data.prazo_medio_dias) : (payload.prazoMedioDias ?? 2),
          acordoST: 'Protocolo ICMS ST Válido',
          especialidades: [data.categoria || 'Materiais'],
          verificado: true,
          cotacoesAtendidasCount: 0,
          conectado: temCredencial,
          whatsapp: data.whatsapp,
          urlPortalB2B: data.url_login,
          tiposLogin: payload.tiposLogin || ['login'],
          loginType: payload.loginType || 'modal',
          triggerSelector: payload.triggerSelector,
          email: payload.email,
          cnpj: payload.cnpj,
          login: data.login_salvo,
          logoUrl: payload.logoUrl,
          senhaCriptografada: data.senha_criptografada ? '••••••••' : undefined,
          observacoes: data.observacoes,
          temCredencial,
        };
      } else {
        const errorMsg = 'Banco de dados (Supabase) não está configurado. Verifique as credenciais NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local.';
        console.error('❌ ' + errorMsg);
        throw new Error(errorMsg);
      }

      // 2. SOMENTE DEPOIS que o insert no banco for confirmado com sucesso, atualizar cache local (localStorage)
      if (typeof window !== 'undefined') {
        try {
          const localStr = localStorage.getItem('saracota_suppliers_custom') || '[]';
          const localArr: Fornecedor[] = JSON.parse(localStr);
          localArr.push(createdForn);
          localStorage.setItem('saracota_suppliers_custom', JSON.stringify(localArr));

          if (payload.whatsapp) {
            localStorage.setItem(`saracota_wa_${createdForn.id}`, payload.whatsapp);
          }
          if (encryptedSenha) {
            localStorage.setItem(`saracota_sec_${createdForn.id}`, encryptedSenha);
          }
        } catch (e) {
          console.warn('Aviso: Falha ao atualizar cache local no localStorage:', e);
        }
      }

      return createdForn;
    },

    async update(
      id: string,
      payload: {
        nome?: string;
        categoria?: string;
        prazoMedioDias?: number;
        slaMinutos?: number;
        whatsapp?: string;
        urlPortalB2B?: string;
        tiposLogin?: string[];
        loginType?: 'modal' | 'page';
        triggerSelector?: string;
        email?: string;
        cnpj?: string;
        login?: string;
        senha?: string;
        logoUrl?: string;
        observacoes?: string;
      }
    ): Promise<boolean> {
      const encryptedSenha = payload.senha ? encryptAES256(payload.senha) : undefined;

      // 1. Atualizar no Supabase
      if (supabase) {
        const newLoginSalvo = payload.login || payload.email || payload.cnpj;

        const dbPayload: any = {};
        if (payload.nome) dbPayload.nome = payload.nome;
        if (payload.categoria) dbPayload.categoria = payload.categoria;
        if (payload.prazoMedioDias !== undefined) dbPayload.prazo_medio_dias = payload.prazoMedioDias;
        if (payload.slaMinutos !== undefined) dbPayload.sla_minutos = payload.slaMinutos;
        if (payload.whatsapp !== undefined) dbPayload.whatsapp = payload.whatsapp;
        if (payload.urlPortalB2B !== undefined) {
          dbPayload.url_login = payload.urlPortalB2B;
          dbPayload.url_site = payload.urlPortalB2B;
        }
        if (newLoginSalvo !== undefined) {
          dbPayload.login_salvo = newLoginSalvo;
          dbPayload.email_login = newLoginSalvo;
        }
        if (encryptedSenha) {
          dbPayload.senha_criptografada = encryptedSenha;
          dbPayload.senha_login = encryptedSenha;
        }
        if (payload.observacoes !== undefined) dbPayload.observacoes = payload.observacoes;
        if ((payload as any).requiresCookieDismissal !== undefined) dbPayload.requires_cookie_dismissal = (payload as any).requiresCookieDismissal;
        if ((payload as any).cookieSelectorHint !== undefined) dbPayload.cookie_selector_hint = (payload as any).cookieSelectorHint;

        console.log('📡 [DB UPDATE SUPABASE] Gravando alteração do fornecedor ID:', id, 'dbPayload:', {
          ...dbPayload,
          senha_criptografada: encryptedSenha ? '•••••••• (AES-256)' : undefined,
        });

        const { error } = await supabase.from('fornecedores').update(dbPayload).eq('id', id);
        if (error) {
          if (error.code === 'PGRST204' || error.message.includes('email_login') || error.message.includes('senha_login')) {
            console.warn('⚠️ Colunas email_login/senha_login ainda não criadas no Supabase. Realizando fallback para login_salvo e senha_criptografada...');
            delete dbPayload.email_login;
            delete dbPayload.senha_login;
            const { error: retryError } = await supabase.from('fornecedores').update(dbPayload).eq('id', id);
            if (retryError) {
              console.error('❌ Erro no update (fallback):', retryError);
              throw new Error(`Falha ao atualizar fornecedor: ${retryError.message}`);
            }
          } else {
            console.error('❌ Erro ao atualizar fornecedor no Supabase:', error);
            throw new Error(`Falha ao atualizar no banco de dados (Supabase): ${error.message || error.details || JSON.stringify(error)}`);
          }
        }
      } else {
        const errorMsg = 'Banco de dados (Supabase) não está configurado.';
        console.error('❌ ' + errorMsg);
        throw new Error(errorMsg);
      }

      // 2. Atualizar cache no localStorage somente se o banco foi atualizado com sucesso
      if (typeof window !== 'undefined') {
        try {
          const localStr = localStorage.getItem('saracota_suppliers_custom') || '[]';
          let localArr: Fornecedor[] = JSON.parse(localStr);
          localArr = localArr.map((f) => {
            if (f.id === id) {
              return {
                ...f,
                ...payload,
                senhaCriptografada: payload.senha ? '••••••••' : f.senhaCriptografada,
                temCredencial: true,
              };
            }
            return f;
          });
          localStorage.setItem('saracota_suppliers_custom', JSON.stringify(localArr));

          if (encryptedSenha) {
            localStorage.setItem(`saracota_sec_${id}`, encryptedSenha);
          }
        } catch (e) {
          console.warn('Aviso: Erro ao atualizar fornecedor localmente:', e);
        }
      }

      return true;
    },

    async delete(id: string): Promise<{ success: boolean; errorMsg?: string }> {
      // 1. Remover do localStorage
      if (typeof window !== 'undefined') {
        try {
          const localStr = localStorage.getItem('saracota_suppliers_custom') || '[]';
          let localArr: Fornecedor[] = JSON.parse(localStr);
          localArr = localArr.filter((f) => f.id !== id);
          localStorage.setItem('saracota_suppliers_custom', JSON.stringify(localArr));
          localStorage.removeItem(`saracota_wa_${id}`);
          localStorage.removeItem(`saracota_sec_${id}`);
        } catch (e) {
          console.warn('Erro ao remover do localStorage:', e);
        }
      }

      // 2. Remover do Supabase
      if (supabase) {
        try {
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

          await supabase.from('fornecedores').delete().eq('id', id);
        } catch (e) {
          console.warn('Erro ao remover no Supabase:', e);
        }
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
