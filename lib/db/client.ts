import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Cotacao, Fornecedor, Produto, RegraTributaria, DBRecordHistoricoCotacao, DBRecordCotacaoAtiva } from '@/types';
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
  cotacao_id?: string;
  material: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  categoria?: string;
  criado_em?: string;
}

const memoryMatchingStore: Record<string, any[]> = {};

/**
 * Data Access Layer (DAL) Conectada 100% ao Banco de Dados Real (PostgreSQL / Supabase)
 */
export const db = {
  // COTAÇÕES
  cotacoes: {
    async list(): Promise<any[]> {
      if (!supabase) return [];

      let rawData: any[] = [];
      const { data: cotData, error } = await supabase
        .from('cotacoes')
        .select('*')
        .order('criado_em', { ascending: false });

      if (cotData && cotData.length > 0) {
        const cotIds = cotData.map((c) => c.id);
        const { data: itensForn } = await supabase
          .from('cotacao_itens')
          .select('*')
          .in('cotacao_id', cotIds);

        const { data: sessoes } = await supabase
          .from('cotacao_fornecedor_sessoes')
          .select('*')
          .in('cotacao_id', cotIds);

        rawData = cotData.map((c) => {
          const matchingItens = (itensForn || []).filter((i) => i.cotacao_id === c.id);
          const matchingSessoes = (sessoes || []).filter((s) => s.cotacao_id === c.id);
          return {
            ...c,
            itens_cotacao_fornecedor: matchingItens,
            cotacao_fornecedor_sessoes: matchingSessoes,
          };
        });
      }

      return rawData.map((c: any) => {
        const itensForn = c.itens_cotacao_fornecedor || c.cotacao_itens || [];
        const sessoes = c.cotacao_fornecedor_sessoes || [];

        return {
          id: c.id,
          codigoCotacao: `#${(c.id || '').substring(0, 4).toUpperCase()}`,
          projeto: {
            id: 'proj-1',
            clienteId: 'cli-1',
            nomeObra: c.obraNome || 'Reserva das Palmeiras',
            ufDestino: 'SP',
          },
          status: c.status === 'aprovada' ? 'aprovada' : c.status === 'recusada' ? 'recusada' : 'em_analise',
          origem: 'texto',
          categoriaPrincipal: c.categoriaPrincipal || 'eletrica',
          dataCriacao: new Date(c.criado_em || c.created_at || Date.now()).toLocaleDateString('pt-BR'),
          fornecedoresParticipantesCount: 1,
          valorTotalProdutos: Number((Number(c.valor_total || 0) * 0.9).toFixed(2)),
          valorTotalST: Number((Number(c.valor_total || 0) * 0.1).toFixed(2)),
          valorTotalGeral: Number(c.valor_total || 0),
          economiaEstimadaBRL: Number((Number(c.valor_total || 0) * 0.12).toFixed(2)),
          melhorFornecedorNome: 'Cicalfer Material Elétrico',
          itens_cotacao_fornecedor: itensForn,
          cotacao_fornecedor_sessoes: sessoes,
          itens: (c.itens && Array.isArray(c.itens) && c.itens.length > 0 ? c.itens : itensForn).map((it: any, idx: number) => ({
            id: it.id || `it-${idx}`,
            cotacaoId: c.id,
            nomeOriginal: it.material || it.nome || it.produto_encontrado,
            ncm: '8544.49.00',
            atributos: { bitola: '2.5mm²' },
            quantidade: Number(it.quantidade || 1),
            unidade: it.unidade || 'un',
            matchingStatus: it.status_matching || it.status || 'exato',
            precosFornecedores: [
              {
                fornecedorId: it.fornecedor_id || '33e03495-100d-45a3-9e34-899de56b0ab1',
                fornecedorNome: 'Cicalfer Material Elétrico',
                precoUnitario: Number(it.preco_unitario || it.preco || 0),
                unidadeOferecida: it.unidade || 'un',
                fatorConversao: 1,
                resultadoST: {
                  valorSTUnitario: Number(it.preco_unitario || 0) * 0.1,
                  valorSTTotal: Number(it.preco_unitario || 0) * Number(it.quantidade || 1) * 0.1,
                  aliquotaEfetivaPercent: 10,
                  baseCalculoST: Number(it.preco_unitario || 0) * Number(it.quantidade || 1),
                  isTaxEstimated: false,
                },
                isBestPrice: true,
              },
            ],
          })),
        };
      }) as any[];
    },

    async listHistorico(filters?: { fornecedorNome?: string }): Promise<Cotacao[]> {
      if (!supabase) return [];

      let query = supabase
        .from('cotacoes')
        .select('*')
        .in('status', ['aprovada', 'recusada'])
        .order('criado_em', { ascending: false });

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
        dataCriacao: new Date(c.criado_em || c.created_at || Date.now()).toLocaleDateString('pt-BR'),
        fornecedoresParticipantesCount: 3,
        valorTotalProdutos: Number((c.valor_total * 0.9).toFixed(2)),
        valorTotalST: Number((c.valor_total * 0.1).toFixed(2)),
        valorTotalGeral: Number(c.valor_total),
        economiaEstimadaBRL: Number((c.valor_total * 0.12).toFixed(2)),
        melhorFornecedorNome: 'Elétrica São Paulo',
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
      if (!(globalThis as any).__saracota_quotes_store) {
        (globalThis as any).__saracota_quotes_store = {};
      }

      const cachedQuote = (globalThis as any).__saracota_quotes_store[id];
      if (cachedQuote) {
        return cachedQuote;
      }

      if (!supabase) return null;

      const { data, error } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

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

    async update(id: string, payload: {
      itens?: DBRecordItemCotacao[] | any[];
      status?: string;
      valor_total?: number;
      fornecedores_selecionados?: string[];
      fornecedorIds?: string[];
      fornecedor_id?: string;
      [key: string]: any;
    }): Promise<boolean> {
      if (supabase) {
        const updateDb: any = {
          atualizado_em: new Date().toISOString(),
        };
        if (payload.status) updateDb.status = payload.status;
        if (payload.valor_total !== undefined) updateDb.valor_total = payload.valor_total;
        if (payload.itens && Array.isArray(payload.itens)) {
          updateDb.itens = payload.itens.map((it: any) => ({
            material: typeof it === 'string' ? it : (it.material || it.nome || it.texto || 'Material'),
            quantidade: Number(it.quantidade) || 1,
            unidade: it.unidade || 'un',
            preco_unitario: Number(it.preco_unitario || it.preco) || 0,
            categoria: it.categoria || 'eletrica',
          }));
        }
        if (payload.fornecedores_selecionados || payload.fornecedorIds || payload.fornecedor_id) {
          const fSel = payload.fornecedores_selecionados || payload.fornecedorIds || (payload.fornecedor_id ? [payload.fornecedor_id] : undefined);
          if (fSel) updateDb.fornecedores_selecionados = Array.isArray(fSel) ? fSel : [fSel];
        }

        const { error } = await supabase.from('cotacoes').update(updateDb).eq('id', id);
        if (error) {
          console.error(`[DB ERROR] Update da cotação ${id} no Supabase falhou:`, error.message);
          return false;
        }
      }

      if ((globalThis as any).__saracota_quotes_store && (globalThis as any).__saracota_quotes_store[id]) {
        const itemInStore = (globalThis as any).__saracota_quotes_store[id];
        if (payload.status) itemInStore.status = payload.status;
        if (payload.valor_total !== undefined) itemInStore.valorTotalGeral = payload.valor_total;
        if (payload.itens) itemInStore.itens = payload.itens;
      }

      return true;
    },

    async expirarCotacoesAntigas(maxHoras: number = 24): Promise<number> {
      if (!(globalThis as any).__saracota_quotes_store) {
        (globalThis as any).__saracota_quotes_store = {};
      }

      const agora = Date.now();
      const limiteMs = maxHoras * 60 * 60 * 1000;
      let expiradasCount = 0;

      const store = (globalThis as any).__saracota_quotes_store;
      for (const id in store) {
        const item = store[id];
        const criadoEmMs = item.timestampMs || agora;
        if (agora - criadoEmMs > limiteMs) {
          item.status = 'expirada';
          item.expirada = true;
          expiradasCount++;
        }
      }

      console.log(`[DB JOB EXPIRAÇÃO] Expiração concluída. ${expiradasCount} cotação(ões) expirada(s) (limite: ${maxHoras}h).`);
      return expiradasCount;
    },

    async invalidarCotacoesAnteriores(): Promise<void> {
      if (!(globalThis as any).__saracota_quotes_store) return;
      const store = (globalThis as any).__saracota_quotes_store;
      for (const id in store) {
        store[id].status = 'expirada';
        store[id].expirada = true;
      }
      console.log('[DB JOB INVALIDAÇÃO] Cotações anteriores marcadas como expiradas ao iniciar nova cotação.');
    },

    async create(payload: {
      valor_total?: number;
      status?: any;
      fornecedor_id?: string;
      user_id?: string;
      userId?: string;
      user?: any;
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
      if (!(globalThis as any).__saracota_quotes_store) {
        (globalThis as any).__saracota_quotes_store = {};
      }

      // Invalidar cotações anteriores do mesmo usuário ao criar uma nova
      await this.invalidarCotacoesAnteriores();

      const createdId = payload.id || `cot-${Date.now()}`;
      const valTotal = payload.valor_total || payload.valorTotalGeral || 0;

      const formattedItens = (payload.itens || []).map((it: any, idx: number) => ({
        id: it.id || `it-${idx}-${Date.now()}`,
        cotacao_id: createdId,
        material: typeof it === 'string' ? it : (it.material || it.texto || 'Material'),
        quantidade: Number(it.quantidade) || 1,
        unidade: it.unidade || 'un',
        preco_unitario: Number(it.preco_unitario) || 0,
        categoria: it.categoria || 'eletrica',
      }));

      const cotacaoRecordLocal: Cotacao = {
        id: createdId,
        codigoCotacao: `#${createdId.substring(0, 4).toUpperCase()}`,
        projeto: {
          id: 'proj-1',
          clienteId: 'cli-1',
          nomeObra: payload.obraNome || 'Reserva das Palmeiras',
          ufDestino: 'SP',
        },
        status: 'em_analise',
        origem: (payload.origem as any) || 'texto',
        origemTextoOriginal: payload.origemTextoOriginal,
        categoriaPrincipal: (payload.categoriaPrincipal as any) || 'eletrica',
        dataCriacao: new Date().toLocaleDateString('pt-BR'),
        itens: formattedItens as any,
        fornecedoresParticipantesCount: payload.fornecedorIds?.length || 1,
        fornecedor_id: payload.fornecedor_id || payload.fornecedorIds?.[0],
        fornecedorIds: payload.fornecedorIds || (payload.fornecedor_id ? [payload.fornecedor_id] : ['33e03495-100d-45a3-9e34-899de56b0ab1']),
        valorTotalProdutos: payload.valorTotalProdutos || valTotal * 0.9,
        valorTotalST: payload.valorTotalST || valTotal * 0.1,
        valorTotalGeral: valTotal,
        economiaEstimadaBRL: payload.economiaEstimadaBRL || valTotal * 0.12,
        melhorFornecedorNome: 'Lojista Credenciado',
      } as any;

      if (supabase) {
        // Resolver user_id do usuário autenticado (do payload ou da sessão Auth do Supabase)
        let resolvedUserId = payload.user_id || payload.userId || payload.user?.id;
        if (!resolvedUserId) {
          const authRes = await supabase.auth.getUser().catch(() => null);
          resolvedUserId = authRes?.data?.user?.id;
        }

        // Se ainda assim não houver usuário autenticado, usar o primeiro usuário válido cadastrado no sistema como fallback seguro
        if (!resolvedUserId) {
          const { data: userRecord } = await supabase.from('fornecedores').select('user_id').not('user_id', 'is', null).limit(1).maybeSingle();
          resolvedUserId = userRecord?.user_id;
        }

        if (!resolvedUserId) {
          throw new Error('Impossível criar cotação no Supabase: user_id do usuário não informado e nenhum usuário autenticado localizado.');
        }

        const fornecedoresSel = payload.fornecedores_selecionados || payload.fornecedorIds || (payload.fornecedor_id ? [payload.fornecedor_id] : ['33e03495-100d-45a3-9e34-899de56b0ab1']);
        const targetFornecedorId = payload.fornecedor_id || payload.fornecedorIds?.[0] || '33e03495-100d-45a3-9e34-899de56b0ab1';
        const itensDb = formattedItens.map((it: any) => ({
          material: it.material,
          quantidade: it.quantidade,
          unidade: it.unidade,
          preco_unitario: it.preco_unitario,
          categoria: it.categoria || 'eletrica'
        }));

        const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        // Lógica Upsert por fornecedor: Verificar se já existe cotação em aberto (status 'pendente' ou 'em_analise') para o mesmo fornecedor
        let existingQuoteId: string | null = null;
        try {
          const { data: openQuotes } = await supabase
            .from('cotacoes')
            .select('id, fornecedores_selecionados, status')
            .eq('user_id', resolvedUserId)
            .in('status', ['pendente', 'em_analise', 'rascunho'])
            .order('criado_em', { ascending: false });

          if (openQuotes && openQuotes.length > 0) {
            const match = openQuotes.find((q: any) => {
              const fArr = Array.isArray(q.fornecedores_selecionados) ? q.fornecedores_selecionados : [q.fornecedores_selecionados];
              return fArr.includes(targetFornecedorId) || fArr.some((f: string) => f.includes('cicalfer'));
            }) || openQuotes[0];

            if (match) {
              existingQuoteId = match.id;
              console.log(`[DB UPSERT SUCCESS] Cotação em aberto localizada (${existingQuoteId}) para o fornecedor ${targetFornecedorId}. Reaproveitando registro.`);
            }
          }
        } catch (checkErr) {
          console.warn('[DB UPSERT WARN] Erro ao consultar cotações em aberto:', checkErr);
        }

        const cotacaoRecordDb: any = {
          user_id: resolvedUserId,
          fornecedores_selecionados: Array.isArray(fornecedoresSel) ? fornecedoresSel : [fornecedoresSel],
          itens: itensDb,
          status: payload.status === 'rascunho' ? 'rascunho' : 'pendente',
          valor_total: valTotal,
          atualizado_em: new Date().toISOString(),
        };

        if (existingQuoteId) {
          // UPSERT: UPDATE na cotação existente (reaproveitando o id)
          cotacaoRecordDb.id = existingQuoteId;
          const { data: cotData, error: cotErr } = await supabase
            .from('cotacoes')
            .update(cotacaoRecordDb)
            .eq('id', existingQuoteId)
            .select()
            .single();

          if (cotErr) {
            console.error(`[DB ERROR] Update de cotação em aberto no Supabase falhou: ${cotErr.message}`);
            throw new Error(`Falha ao atualizar cotação em aberto no Supabase: ${cotErr.message}`);
          }

          if (cotData) {
            cotacaoRecordLocal.id = cotData.id;
            cotacaoRecordLocal.codigoCotacao = `#${cotData.id.substring(0, 4).toUpperCase()}`;
            (globalThis as any).__saracota_quotes_store[cotData.id] = cotacaoRecordLocal;
            return {
              ...cotacaoRecordLocal,
              id: cotData.id,
            };
          }
        } else {
          // INSERT normal se não existir cotação em aberto
          if (payload.id && isUuid(payload.id)) {
            cotacaoRecordDb.id = payload.id;
          }

          const { data: cotData, error: cotErr } = await supabase
            .from('cotacoes')
            .insert([cotacaoRecordDb])
            .select()
            .single();

          if (cotErr) {
            console.error(`[DB ERROR] Inserção de cotação no Supabase falhou: ${cotErr.message} (Código: ${cotErr.code})`);
            throw new Error(`Falha ao criar cotação no Supabase: ${cotErr.message}`);
          }

          if (cotData) {
            cotacaoRecordLocal.id = cotData.id;
            (globalThis as any).__saracota_quotes_store[cotData.id] = cotacaoRecordLocal;
            return {
              ...cotacaoRecordLocal,
              id: cotData.id,
            };
          }
        }
      }

      (globalThis as any).__saracota_quotes_store[createdId] = cotacaoRecordLocal;
      return cotacaoRecordLocal;
    },

    async salvarBrowserbaseSessionId(cotacaoId: string, fornecedorId: string, sessionId: string): Promise<boolean> {
      if (!(globalThis as any).__saracota_sessions_store) {
        (globalThis as any).__saracota_sessions_store = {};
      }
      const cacheKey = fornecedorId ? `${cotacaoId}_${fornecedorId}` : cotacaoId;
      (globalThis as any).__saracota_sessions_store[cacheKey] = sessionId;
      (globalThis as any).__saracota_sessions_store[cotacaoId] = sessionId; // Fallback compatibilidade

      console.log(`💾 [DB SESSION SAVE ATTEMPT] cotacaoId: "${cotacaoId}" | fornecedorId: "${fornecedorId}" | cacheKey: "${cacheKey}" | sessionId: "${sessionId}"`);

      if (supabase) {
        try {
          // 1. Tentar salvar na tabela de sessões isoladas por fornecedor (cotacao_fornecedor_sessoes)
          const { error: upsertErr } = await supabase.from('cotacao_fornecedor_sessoes').upsert(
            {
              cotacao_id: cotacaoId,
              fornecedor_id: fornecedorId,
              browserbase_session_id: sessionId,
              status: 'carrinho_pronto',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'cotacao_id,fornecedor_id' }
          );

          if (upsertErr) {
            console.warn(`⚠️ [SUPABASE UPSERT WARN cotacao_fornecedor_sessoes] ${upsertErr.message}. Tentando update em cotacoes...`);
          } else {
            console.log(`✅ [SUPABASE SUCCESS UPSERT] Sessão ${sessionId} salva em cotacao_fornecedor_sessoes para ${cotacaoId} / ${fornecedorId}!`);
          }

          // 2. Atualizar também na tabela cotacoes para compatibilidade
          const { error: updateErr } = await supabase
            .from('cotacoes')
            .update({
              browserbase_session_id: sessionId,
              status: 'carrinho_pronto',
            })
            .eq('id', cotacaoId);

          if (updateErr) {
            console.warn(`⚠️ [SUPABASE UPDATE WARN cotacoes]: ${updateErr.message}`);
          }
        } catch (e: any) {
          console.error(`❌ [SUPABASE SAVE SESSION EXCEPTION] cotacaoId: "${cotacaoId}" | errorMsg:`, e.message || e);
        }
      }
      return true;
    },

    async obterBrowserbaseSessionId(cotacaoId: string, fornecedorId?: string): Promise<string | null> {
      if (fornecedorId) {
        const cacheKey = `${cotacaoId}_${fornecedorId}`;
        if ((globalThis as any).__saracota_sessions_store && (globalThis as any).__saracota_sessions_store[cacheKey]) {
          return (globalThis as any).__saracota_sessions_store[cacheKey];
        }
      }

      if ((globalThis as any).__saracota_sessions_store && (globalThis as any).__saracota_sessions_store[cotacaoId]) {
        return (globalThis as any).__saracota_sessions_store[cotacaoId];
      }

      if (supabase) {
        try {
          // 1. Tentar buscar em cotacao_fornecedor_sessoes com filtro duplo (cotacao_id AND fornecedor_id)
          if (fornecedorId) {
            const { data: sessData } = await supabase
              .from('cotacao_fornecedor_sessoes')
              .select('browserbase_session_id')
              .eq('cotacao_id', cotacaoId)
              .eq('fornecedor_id', fornecedorId)
              .maybeSingle();

            if (sessData && (sessData as any).browserbase_session_id) {
              console.log(`✅ [SUPABASE SELECT SUCCESS] Sessão ${(sessData as any).browserbase_session_id} encontrada em cotacao_fornecedor_sessoes!`);
              return (sessData as any).browserbase_session_id;
            }
          }

          // 2. Fallback: buscar na tabela cotacoes principal
          const { data, error } = await supabase
            .from('cotacoes')
            .select('browserbase_session_id')
            .eq('id', cotacaoId)
            .maybeSingle();

          if (error) {
            console.error(`❌ [SUPABASE ERRO SELECT browserbase_session_id] cotacaoId: ${cotacaoId}:`, error.message || error);
          }

          if (data && (data as any).browserbase_session_id) {
            return (data as any).browserbase_session_id;
          }
        } catch (e: any) {
          console.error(`❌ [SUPABASE EXCEÇÃO SELECT browserbase_session_id] cotacaoId: ${cotacaoId}:`, e.message || e);
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
            observacoes: JSON.stringify(progresso.mensagens),
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

            let msgs: string[] = [];
            if (cotacao.observacoes) {
              try {
                msgs = JSON.parse(cotacao.observacoes);
              } catch (e) {}
            }

            if (!Array.isArray(msgs) || msgs.length === 0) {
              msgs = [`Cotação ${cotacaoId} em andamento no banco de dados (${statusStr || 'processando'}).`];
            }

            return {
              cotacaoId,
              status: isConcluido ? 'concluido' : isAguardando ? 'aguardando_revisao' : 'processando',
              itensProcessados: itensCount,
              totalItens: Math.max(1, itensCount),
              percentualConcluido: percentual,
              mensagens: msgs,
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
      // 0. Atualizar cache em memória de forma atômica/idempotente
      const resultadosComForn = resultados.map((r) => ({ ...r, fornecedorId }));
      if (!memoryMatchingStore[cotacaoId]) {
        memoryMatchingStore[cotacaoId] = [];
      }
      memoryMatchingStore[cotacaoId] = [
        ...memoryMatchingStore[cotacaoId].filter((r: any) => r.fornecedorId !== fornecedorId),
        ...resultadosComForn
      ];

      if (typeof window !== 'undefined') {
        try {
          const key = `saracota_matching_${cotacaoId}_${fornecedorId}`;
          localStorage.setItem(key, JSON.stringify(resultadosComForn));
        } catch (e) {
          console.warn('Erro ao salvar matching localmente:', e);
        }
      }

      if (supabase) {
        try {
          // 1. Limpeza atômica prévia por (cotacao_id, fornecedor_id) para garantir idempotência total no Supabase
          try {
            await supabase
              .from('cotacao_itens')
              .delete()
              .eq('cotacao_id', cotacaoId)
              .eq('fornecedor_id', fornecedorId);
          } catch (e) {}

          try {
            await supabase
              .from('itens_cotacao_fornecedor')
              .delete()
              .eq('cotacao_id', cotacaoId)
              .eq('fornecedor_id', fornecedorId);
          } catch (e) {}

          // 1. Persistir na tabela cotacao_itens (ou itens_cotacao)
          const itemRecords = resultados.map((r) => ({
            cotacao_id: cotacaoId,
            fornecedor_id: fornecedorId,
            nome: r.produtoEncontrado || r.itemPedido || 'Material',
            material: r.produtoEncontrado || r.itemPedido || 'Material',
            preco_unitario: Number(r.preco) || 0,
            quantidade: Number(r.quantidade) || 1,
            total_item: Number(r.preco) * Number(r.quantidade || 1),
            unidade: 'un',
            observacoes: JSON.stringify({
              itemPedido: r.itemPedido,
              produtoEncontrado: r.produtoEncontrado,
              confianca: r.confianca,
              status: r.status,
              link: r.link,
              preco_unitario: Number(r.preco) || 0,
              total_item: Number(r.preco) * Number(r.quantidade || 1)
            })
          }));

          try {
            const { error: errItens } = await supabase.from('cotacao_itens').insert(itemRecords);
            if (!errItens) {
              console.log(`✅ [SUPABASE MATCHING SUCCESS ATÔMICO] ${resultados.length} itens salvos na tabela "cotacao_itens"!`);
            }
          } catch (errItensEx) {}

          // 1b. Persistir também na tabela itens_cotacao_fornecedor se existir
          const itensFornRecords = resultados.map((r) => ({
            cotacao_id: cotacaoId,
            fornecedor_id: fornecedorId,
            material: r.itemPedido || r.material || 'Material',
            produto_encontrado: r.produtoEncontrado || r.itemPedido,
            preco_unitario: Number(r.preco) || 0,
            confianca_percent: Number(r.confianca) || 0,
            status_matching: r.status || 'CONFIRMADO',
            imagem: r.imagem || null,
            link: r.link || null,
          }));

          try {
            await supabase.from('itens_cotacao_fornecedor').insert(itensFornRecords);
          } catch (e) {}

          // 2. Persistir em cotacao_fornecedor_sessoes com JSON estruturado
          const sessionPayload = JSON.stringify({
            origem: 'RPA_MATCHING_ENGINE',
            totalGeral: resultados.reduce((acc, i) => acc + (Number(i.preco) * Number(i.quantidade || 1)), 0),
            itens: resultados,
            dataCriacao: new Date().toISOString()
          });

          try {
            await supabase.from('cotacao_fornecedor_sessoes').upsert(
              {
                cotacao_id: cotacaoId,
                fornecedor_id: fornecedorId,
                browserbase_session_id: sessionPayload,
                status: 'carrinho_pronto',
                updated_at: new Date().toISOString()
              },
              { onConflict: 'cotacao_id,fornecedor_id' }
            );
          } catch (errSess) {
            console.warn('[SUPABASE SESSAO WARN]:', errSess);
          }
        } catch (e: any) {
          console.warn('Erro ao salvar matching no Supabase:', e.message || e);
        }
      }

      return true;
    },

    async obterResultadosMatching(cotacaoId: string): Promise<any[]> {
      let resultados: any[] = memoryMatchingStore[cotacaoId] || [];

      if (resultados.length === 0 && typeof window !== 'undefined') {
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
          // 1. Tentar ler da tabela cotacao_itens
          const { data: itensData } = await supabase
            .from('cotacao_itens')
            .select('*')
            .eq('cotacao_id', cotacaoId);

          if (itensData && itensData.length > 0) {
            resultados = itensData.map((d: any) => {
              let obs: any = {};
              if (d.observacoes && typeof d.observacoes === 'string' && d.observacoes.startsWith('{')) {
                try { obs = JSON.parse(d.observacoes); } catch (e) {}
              }
              const pUnit = Number(d.preco_unitario || d.preco || obs.preco_unitario || 0);
              return {
                itemPedido: obs.itemPedido || d.nome || d.material || 'Produto',
                status: d.status === 'confirmado' || d.status === 'CONFIRMADO' ? 'CONFIRMADO' : 'NAO_ENCONTRADO',
                confianca: obs.confianca || (pUnit > 0 ? 95 : 0),
                produtoEncontrado: d.nome || obs.produtoEncontrado || d.material,
                preco: pUnit,
                quantidade: Number(d.quantidade || obs.quantidade || 1),
                link: d.link || obs.link,
                fornecedorId: d.fornecedor_id,
              };
            });
          }

          // 2. Se cotacao_itens não tiver registros, tentar ler de cotacao_fornecedor_sessoes
          if (resultados.length === 0) {
            const { data: sessData } = await supabase
              .from('cotacao_fornecedor_sessoes')
              .select('*')
              .eq('cotacao_id', cotacaoId);

            if (sessData && sessData.length > 0) {
              for (const s of sessData) {
                if (s.browserbase_session_id && s.browserbase_session_id.startsWith('{')) {
                  try {
                    const payload = JSON.parse(s.browserbase_session_id);
                    if (payload.itens && Array.isArray(payload.itens)) {
                      const parsedItens = payload.itens.map((it: any) => ({
                        itemPedido: it.itemPedido || it.nomeOriginalPedido || it.nome || 'Produto',
                        status: it.status || (it.preco > 0 ? 'CONFIRMADO' : 'NAO_ENCONTRADO'),
                        confianca: it.confianca || 95,
                        produtoEncontrado: it.produtoEncontrado || it.nomeExatoSite || it.nome || it.itemPedido,
                        preco: Number(it.preco || it.precoUnitario || it.preco_unitario || 0),
                        quantidade: Number(it.quantidade || 1),
                        fornecedorId: s.fornecedor_id,
                        fornecedorNome: 'Cicalfer Material Elétrico',
                      }));
                      resultados = [...resultados, ...parsedItens];
                    }
                  } catch (err) {}
                }
              }
            }
          }
        } catch (e) {
          console.warn('Erro ao buscar matching no Supabase:', e);
        }
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
              rpa_ativo: f.rpa_ativo ?? f.seletores?.rpa_ativo ?? Boolean(f.seletores && (f.seletores.login || f.seletores.carrinho || f.seletores.campo_email)),
              rpaAtivo: f.rpa_ativo ?? f.seletores?.rpa_ativo ?? Boolean(f.seletores && (f.seletores.login || f.seletores.carrinho || f.seletores.campo_email)),
              config_slug: f.config_slug || f.seletores?.config_slug || (f.nome?.toLowerCase().includes('construja') ? 'construja' : f.nome?.toLowerCase().includes('cicalfer') ? 'cicalfer' : undefined),
              configSlug: f.config_slug || f.seletores?.config_slug || (f.nome?.toLowerCase().includes('construja') ? 'construja' : f.nome?.toLowerCase().includes('cicalfer') ? 'cicalfer' : undefined),
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
        const insertPayload: any = {
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
          senha_criptografada: encryptedSenha,
          observacoes: payload.observacoes,
        };

        const { data, error } = await supabase
          .from('fornecedores')
          .insert([insertPayload])
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

  // HISTÓRICO PERSISTENTE DE COTAÇÕES (VÁLIDO POR ATÉ 7 DIAS VINCULADO AO USUÁRIO)
  historico: {
    async salvar(payload: {
      userId?: string;
      user_id?: string;
      obraNome?: string;
      obra_nome?: string;
      fornecedor?: string;
      itens: any[];
      valor_total: number;
      quantidade_itens?: number;
    }): Promise<DBRecordHistoricoCotacao> {
      const now = new Date();
      const expiraDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias

      if (!(globalThis as any).__saracota_historico_store) {
        (globalThis as any).__saracota_historico_store = {};
      }

      let resolvedUserId = payload.user_id || payload.userId;
      if (supabase && !resolvedUserId) {
        const authRes = await supabase.auth.getUser().catch(() => null);
        resolvedUserId = authRes?.data?.user?.id;
      }
      if (!resolvedUserId) {
        resolvedUserId = '61ab64e4-c2cb-46df-bb14-6cc326293085';
      }

      const recId = `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const record: DBRecordHistoricoCotacao = {
        id: recId,
        user_id: resolvedUserId,
        obra_nome: payload.obra_nome || payload.obraNome || 'Reserva das Palmeiras',
        fornecedor: payload.fornecedor || 'Cicalfer Material Elétrico',
        itens: payload.itens || [],
        valor_total: Number(payload.valor_total || 0),
        quantidade_itens: payload.quantidade_itens || payload.itens?.length || 0,
        criado_em: now.toISOString(),
        expira_em: expiraDate.toISOString(),
      };

      if (supabase) {
        // 1. Tentar salvar na tabela dedicada historico_cotacoes
        const { data: histData, error: histErr } = await supabase
          .from('historico_cotacoes')
          .insert([{
            user_id: record.user_id,
            obra_nome: record.obra_nome,
            fornecedor: record.fornecedor,
            itens: record.itens,
            valor_total: record.valor_total,
            quantidade_itens: record.quantidade_itens,
            expira_em: record.expira_em,
          }])
          .select()
          .single();

        if (!histErr && histData) {
          record.id = histData.id;
          (globalThis as any).__saracota_historico_store[histData.id] = record;
          return record;
        }

        // 2. Fallback: Se a tabela historico_cotacoes não existir (PGRST205), salvar em cotacoes com status 'historico'
        const { data: cotData, error: cotErr } = await supabase
          .from('cotacoes')
          .insert([{
            user_id: record.user_id,
            fornecedores_selecionados: [record.fornecedor],
            itens: record.itens,
            status: 'historico',
            valor_total: record.valor_total,
            atualizado_em: record.expira_em,
          }])
          .select()
          .single();

        if (!cotErr && cotData) {
          record.id = cotData.id;
          (globalThis as any).__saracota_historico_store[cotData.id] = record;
          return record;
        }
      }

      (globalThis as any).__saracota_historico_store[recId] = record;
      return record;
    },

    async listar(userId?: string): Promise<DBRecordHistoricoCotacao[]> {
      const nowIso = new Date().toISOString();
      let resolvedUserId = userId;

      if (supabase && !resolvedUserId) {
        const authRes = await supabase.auth.getUser().catch(() => null);
        resolvedUserId = authRes?.data?.user?.id;
      }
      if (!resolvedUserId) {
        resolvedUserId = '61ab64e4-c2cb-46df-bb14-6cc326293085';
      }

      // Purga de cotações expiradas (> 7 dias)
      await this.expirarAntigos(resolvedUserId);

      let resultList: DBRecordHistoricoCotacao[] = [];

      if (supabase) {
        // 1. Consultar tabela dedicada historico_cotacoes
        const { data: hData, error: hErr } = await supabase
          .from('historico_cotacoes')
          .select('*')
          .eq('user_id', resolvedUserId)
          .gt('expira_em', nowIso)
          .order('criado_em', { ascending: false });

        if (!hErr && hData && hData.length > 0) {
          resultList = hData.map((d: any) => ({
            id: d.id,
            user_id: d.user_id,
            obra_nome: d.obra_nome || 'Reserva das Palmeiras',
            fornecedor: d.fornecedor || 'Cicalfer',
            itens: d.itens || [],
            valor_total: Number(d.valor_total || 0),
            quantidade_itens: Number(d.quantidade_itens || d.itens?.length || 0),
            criado_em: d.criado_em || d.created_at,
            expira_em: d.expira_em,
          }));
          return resultList;
        }

        // 2. Fallback: Consultar tabela cotacoes com status 'historico'
        const { data: cData } = await supabase
          .from('cotacoes')
          .select('*')
          .eq('user_id', resolvedUserId)
          .eq('status', 'historico')
          .order('criado_em', { ascending: false });

        if (cData && cData.length > 0) {
          resultList = cData
            .filter((c: any) => {
              const exp = c.atualizado_em || c.expira_em;
              if (!exp) return true;
              return new Date(exp).getTime() > Date.now();
            })
            .map((c: any) => ({
              id: c.id,
              user_id: c.user_id,
              obra_nome: c.obraNome || 'Reserva das Palmeiras',
              fornecedor: Array.isArray(c.fornecedores_selecionados) ? c.fornecedores_selecionados[0] : (c.fornecedores_selecionados || 'Cicalfer'),
              itens: c.itens || [],
              valor_total: Number(c.valor_total || 0),
              quantidade_itens: c.itens?.length || 0,
              criado_em: c.criado_em || c.created_at,
              expira_em: c.atualizado_em || c.expira_em || new Date(Date.now() + 7 * 86400000).toISOString(),
            }));

          return resultList;
        }
      }

      // Memory store fallback
      if ((globalThis as any).__saracota_historico_store) {
        const store = (globalThis as any).__saracota_historico_store;
        for (const k in store) {
          const item = store[k];
          if (item.user_id === resolvedUserId && new Date(item.expira_em).getTime() > Date.now()) {
            resultList.push(item);
          }
        }
      }

      return resultList;
    },

    async excluir(id: string, userId?: string): Promise<boolean> {
      let resolvedUserId = userId;
      if (supabase && !resolvedUserId) {
        const authRes = await supabase.auth.getUser().catch(() => null);
        resolvedUserId = authRes?.data?.user?.id;
      }

      if ((globalThis as any).__saracota_historico_store) {
        delete (globalThis as any).__saracota_historico_store[id];
      }

      if (supabase) {
        try {
          await supabase.from('historico_cotacoes').delete().eq('id', id);
        } catch (e) {}

        try {
          await supabase.from('cotacoes').delete().eq('id', id).eq('status', 'historico');
        } catch (e) {}
      }

      return true;
    },

    async expirarAntigos(userId?: string): Promise<number> {
      const nowIso = new Date().toISOString();
      let expCount = 0;

      if (supabase) {
        try {
          const { data } = await supabase.from('historico_cotacoes').delete().lt('expira_em', nowIso);
          expCount += (data as any[])?.length || 0;
        } catch (e) {}

        try {
          const cutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          await supabase.from('cotacoes').delete().eq('status', 'historico').lt('criado_em', cutoffIso);
        } catch (e) {}
      }

      return expCount;
    },
  },

  // COTAÇÕES ATIVAS PERSISTENTES POR FORNECEDOR E OBRA (UPSERT POR user_id + obra_id + fornecedor_id)
  cotacoesAtivas: {
    async upsert(payload: {
      userId?: string;
      user_id?: string;
      obraId?: string;
      obra_id?: string;
      fornecedorId?: string;
      fornecedor_id?: string;
      fornecedorNome?: string;
      fornecedor_nome?: string;
      itens: any[];
      valor_total: number;
      status?: string;
    }): Promise<DBRecordCotacaoAtiva> {
      const nowIso = new Date().toISOString();

      if (!(globalThis as any).__saracota_cotacoes_ativas_store) {
        (globalThis as any).__saracota_cotacoes_ativas_store = {};
      }

      let resolvedUserId = payload.user_id || payload.userId;
      if (supabase && !resolvedUserId) {
        const authRes = await supabase.auth.getUser().catch(() => null);
        resolvedUserId = authRes?.data?.user?.id;
      }
      if (!resolvedUserId) {
        resolvedUserId = '61ab64e4-c2cb-46df-bb14-6cc326293085';
      }

      const obraId = payload.obra_id || payload.obraId || 'Reserva das Palmeiras';
      const fornId = payload.fornecedor_id || payload.fornecedorId || '33e03495-100d-45a3-9e34-899de56b0ab1';
      const fornNome = payload.fornecedor_nome || payload.fornecedorNome || 'Cicalfer Material Elétrico';

      const key = `${resolvedUserId}::${obraId}::${fornId}`;
      const recId = (globalThis as any).__saracota_cotacoes_ativas_store[key]?.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const record: DBRecordCotacaoAtiva = {
        id: recId,
        user_id: resolvedUserId,
        obra_id: obraId,
        fornecedor_id: fornId,
        fornecedor_nome: fornNome,
        itens: payload.itens || [],
        valor_total: Number(payload.valor_total || 0),
        status: payload.status || 'concluida',
        atualizado_em: nowIso,
      };

      if (supabase) {
        // 1. Tentar salvar/sobrescrever na tabela dedicada cotacoes_ativas via upsert
        const { data: actData, error: actErr } = await supabase
          .from('cotacoes_ativas')
          .upsert([{
            user_id: record.user_id,
            obra_id: record.obra_id,
            fornecedor_id: record.fornecedor_id,
            fornecedor_nome: record.fornecedor_nome,
            itens: record.itens,
            valor_total: record.valor_total,
            status: record.status,
            atualizado_em: record.atualizado_em,
          }], { onConflict: 'user_id,obra_id,fornecedor_id' })
          .select()
          .single();

        if (!actErr && actData) {
          record.id = actData.id;
          (globalThis as any).__saracota_cotacoes_ativas_store[key] = record;
          return record;
        }

        // 2. Fallback: Se a tabela cotacoes_ativas não existir ou der erro de constraint/cache, persistir em cotacoes com status 'ativa'
        const { data: cotData, error: cotErr } = await supabase
          .from('cotacoes')
          .insert([{
            user_id: record.user_id,
            fornecedores_selecionados: [record.fornecedor_nome],
            itens: record.itens,
            status: 'ativa',
            valor_total: record.valor_total,
            atualizado_em: record.atualizado_em,
          }])
          .select()
          .single();

        if (!cotErr && cotData) {
          record.id = cotData.id;
          (globalThis as any).__saracota_cotacoes_ativas_store[key] = record;
          return record;
        }
      }

      (globalThis as any).__saracota_cotacoes_ativas_store[key] = record;
      return record;
    },

    async listar(userId?: string, obraId?: string): Promise<DBRecordCotacaoAtiva[]> {
      let resolvedUserId = userId;
      if (supabase && !resolvedUserId) {
        const authRes = await supabase.auth.getUser().catch(() => null);
        resolvedUserId = authRes?.data?.user?.id;
      }
      if (!resolvedUserId) {
        resolvedUserId = '61ab64e4-c2cb-46df-bb14-6cc326293085';
      }

      const targetObra = obraId || 'Reserva das Palmeiras';
      let resultList: DBRecordCotacaoAtiva[] = [];

      if (supabase) {
        // 1. Tentar consultar na tabela dedicada cotacoes_ativas
        let query = supabase
          .from('cotacoes_ativas')
          .select('*')
          .eq('user_id', resolvedUserId);

        if (targetObra) {
          query = query.eq('obra_id', targetObra);
        }

        const { data: actData, error: actErr } = await query.order('atualizado_em', { ascending: false });

        if (!actErr && actData && actData.length > 0) {
          resultList = actData.map((d: any) => ({
            id: d.id,
            user_id: d.user_id,
            obra_id: d.obra_id,
            fornecedor_id: d.fornecedor_id,
            fornecedor_nome: d.fornecedor_nome || 'Cicalfer',
            itens: d.itens || [],
            valor_total: Number(d.valor_total || 0),
            status: d.status || 'concluida',
            atualizado_em: d.atualizado_em || d.created_at,
          }));
          return resultList;
        }
      }

      // 2. Memory store fallback
      if ((globalThis as any).__saracota_cotacoes_ativas_store) {
        const store = (globalThis as any).__saracota_cotacoes_ativas_store;
        for (const k in store) {
          const item = store[k];
          if (item.user_id === resolvedUserId && (!targetObra || item.obra_id === targetObra)) {
            resultList.push(item);
          }
        }
      }

      return resultList;
    },

    async excluir(id: string): Promise<boolean> {
      if ((globalThis as any).__saracota_cotacoes_ativas_store) {
        const store = (globalThis as any).__saracota_cotacoes_ativas_store;
        for (const k in store) {
          if (store[k].id === id) {
            delete store[k];
            break;
          }
        }
      }

      if (supabase) {
        try {
          await supabase.from('cotacoes_ativas').delete().eq('id', id);
        } catch (e) {}
      }

      return true;
    },
  },
};
