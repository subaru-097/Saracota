'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/db/client';

interface ItemPendente {
  id: string;
  cotacao_id?: string;
  item_lista_id?: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  nome_bruto: string;
  categoria?: string;
  motivo_pendencia?: 'matching_ambiguo' | 'atributo_ausente_fornecedor' | 'sem_candidato';
  candidatos_json: {
    sku?: string;
    nome: string;
    preco?: number;
    score: number;
    motivos?: string;
  }[];
  status: 'pendente' | 'vinculado' | 'ignorado';
  criado_em: string;
}

interface GrupoPendencia {
  categoriaMotivo: string;
  itens: ItemPendente[];
}

export default function TelaPendenciasPage() {
  const [pendencias, setPendencias] = useState<ItemPendente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [vincularMap, setVincularMap] = useState<Record<string, string>>({});
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [processandoLote, setProcessandoLote] = useState<boolean>(false);

  useEffect(() => {
    carregarPendencias();
  }, []);

  async function carregarPendencias() {
    setLoading(true);
    if (!supabase) {
      setPendencias([
        {
          id: 'pend-1',
          nome_bruto: 'BROCA P/ MADEIRA CHATA 1/2 PT SPARTA',
          fornecedor_nome: 'Cofema Atacadista',
          categoria: 'Ferramentas',
          motivo_pendencia: 'matching_ambiguo',
          status: 'pendente',
          criado_em: new Date().toISOString(),
          candidatos_json: [
            { nome: 'Broca Chata Para Madeira 1/2" Sparta', preco: 8.50, score: 0.72, motivos: 'Medida compatível (1/2")' },
          ],
        },
        {
          id: 'pend-2',
          nome_bruto: 'CAIXA LUZ OCTOGONAL 4X4 ADTEX',
          fornecedor_nome: 'Construjá',
          categoria: 'Elétrica',
          motivo_pendencia: 'atributo_ausente_fornecedor',
          status: 'pendente',
          criado_em: new Date().toISOString(),
          candidatos_json: [
            { nome: 'Caixa de Luz Octogonal PVC 4x4 Tigre', preco: 4.30, score: 0.68, motivos: 'Marca ausente no catálogo' },
          ],
        },
        {
          id: 'pend-3',
          nome_bruto: 'CAIXA LUZ 4X2 PVC ADTEX',
          fornecedor_nome: 'Construjá',
          categoria: 'Elétrica',
          motivo_pendencia: 'atributo_ausente_fornecedor',
          status: 'pendente',
          criado_em: new Date().toISOString(),
          candidatos_json: [
            { nome: 'Caixa de Luz Rectangular 4x2 PVC Tigre', preco: 3.90, score: 0.75, motivos: 'Marca ausente no catálogo' },
          ],
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('itens_pendentes_revisao')
        .select('*')
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setPendencias(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar pendências:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Agrupamento por Categoria + Motivo da Pendência
  const grupos: GrupoPendencia[] = React.useMemo(() => {
    const map = new Map<string, ItemPendente[]>();

    for (const item of pendencias) {
      const cat = item.categoria || 'Geral';
      const motivoLabel =
        item.motivo_pendencia === 'atributo_ausente_fornecedor'
          ? 'Atributo Faltante no Site do Fornecedor'
          : item.motivo_pendencia === 'matching_ambiguo'
          ? 'Similaridade Ambígua (Necessita Validação)'
          : 'Sem Candidato Direto';

      const key = `${cat} — ${motivoLabel}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    return Array.from(map.entries()).map(([categoriaMotivo, itens]) => ({
      categoriaMotivo,
      itens,
    }));
  }, [pendencias]);

  // Ação em Massa: Vincular todos os itens sugeridos do grupo
  async function handleAprovarLoteGrupo(grupo: GrupoPendencia, minScore: number = 0.60) {
    setProcessandoLote(true);
    let vinculadosCount = 0;

    try {
      for (const item of grupo.itens) {
        const topCandidato = item.candidatos_json?.[0];
        if (topCandidato && topCandidato.score >= minScore) {
          const nomeFinal = topCandidato.nome;

          if (supabase && item.fornecedor_id) {
            let canonicoId: string | null = null;
            const { data: catData } = await supabase
              .from('produtos_canonicos')
              .select('id')
              .eq('nome_limpo', nomeFinal)
              .maybeSingle();

            if (catData) {
              canonicoId = catData.id;
            } else {
              const { data: newCat } = await supabase
                .from('produtos_canonicos')
                .insert([{ nome_limpo: nomeFinal, categoria: item.categoria || 'geral' }])
                .select()
                .single();
              canonicoId = newCat?.id;
            }

            if (canonicoId) {
              await supabase.from('sinonimos_por_fornecedor').upsert([
                {
                  fornecedor_id: item.fornecedor_id,
                  nome_bruto_fornecedor: item.nome_bruto.trim().toUpperCase(),
                  produto_canonico_id: canonicoId,
                  criado_por_usuario: true,
                },
              ]);
            }

            await supabase
              .from('itens_pendentes_revisao')
              .update({ status: 'vinculado', resolvido_em: new Date().toISOString() })
              .eq('id', item.id);
          }

          vinculadosCount++;
        }
      }

      const idsResolvidos = new Set(grupo.itens.map((i) => i.id));
      setPendencias((prev) => prev.filter((p) => !idsResolvidos.has(p.id)));

      setMensagemSucesso(`⚡ AÇÃO EM MASSA CONCLUÍDA: ${vinculadosCount} itens do grupo "${grupo.categoriaMotivo}" foram vinculados em lote! Depara atualizado.`);
      setTimeout(() => setMensagemSucesso(null), 5000);
    } catch (err: any) {
      alert(`Erro na ação em massa: ${err.message}`);
    } finally {
      setProcessandoLote(false);
    }
  }

  async function handleVincular(item: ItemPendente, nomeProdutoSelecionado?: string) {
    const nomeFinal = nomeProdutoSelecionado || vincularMap[item.id] || item.candidatos_json?.[0]?.nome || item.nome_bruto;

    try {
      if (supabase && item.fornecedor_id) {
        let canonicoId: string | null = null;
        const { data: catData } = await supabase
          .from('produtos_canonicos')
          .select('id')
          .eq('nome_limpo', nomeFinal)
          .maybeSingle();

        if (catData) {
          canonicoId = catData.id;
        } else {
          const { data: newCat } = await supabase
            .from('produtos_canonicos')
            .insert([{ nome_limpo: nomeFinal, categoria: item.categoria || 'geral' }])
            .select()
            .single();
          canonicoId = newCat?.id;
        }

        if (canonicoId) {
          await supabase.from('sinonimos_por_fornecedor').upsert([
            {
              fornecedor_id: item.fornecedor_id,
              nome_bruto_fornecedor: item.nome_bruto.trim().toUpperCase(),
              produto_canonico_id: canonicoId,
              criado_por_usuario: true,
            },
          ]);
        }

        await supabase
          .from('itens_pendentes_revisao')
          .update({ status: 'vinculado', resolvido_em: new Date().toISOString() })
          .eq('id', item.id);
      }

      setMensagemSucesso(`✅ Item "${item.nome_bruto}" vinculado a "${nomeFinal}"! Tabela de sinônimos atualizada.`);
      setPendencias((prev) => prev.filter((p) => p.id !== item.id));

      setTimeout(() => setMensagemSucesso(null), 5000);
    } catch (err: any) {
      alert(`Erro ao vincular item: ${err.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0c0e] text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 border-b border-slate-800 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg text-xl">⏳</span>
              Fila de Pendências — Triagem em Lote e Revisão (Nível 3)
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              Agrupamento inteligente por padrão comum e botões de ação em massa para aprovação instantânea por grupo de produtos.
            </p>
          </div>
          <button
            onClick={carregarPendencias}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
          >
            🔄 Atualizar Fila
          </button>
        </header>

        {mensagemSucesso && (
          <div className="mb-6 p-4 bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 rounded-xl text-sm font-medium flex items-center justify-between shadow-lg">
            <span>{mensagemSucesso}</span>
            <button onClick={() => setMensagemSucesso(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-500">Carregando itens pendentes de revisão...</div>
        ) : pendencias.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-xl font-bold text-white mb-2">Nenhuma pendência na fila</h3>
            <p className="text-slate-400 text-sm">Todos os produtos anteriores foram vinculados automaticamente ou aprovados em massa.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grupos.map((grupo, gIdx) => (
              <div key={gIdx} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
                {/* Cabeçalho do Grupo com Ação em Lote */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
                  <div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-md">
                      Grupo {gIdx + 1} ({grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'})
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-2">{grupo.categoriaMotivo}</h2>
                  </div>

                  <button
                    onClick={() => handleAprovarLoteGrupo(grupo, 0.60)}
                    disabled={processandoLote}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2"
                  >
                    ⚡ Aprovar Lote Sugerido ({grupo.itens.length} Itens)
                  </button>
                </div>

                {/* Lista de Itens do Grupo */}
                <div className="grid gap-4">
                  {grupo.itens.map((item) => (
                    <div key={item.id} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                        <div>
                          <span className="text-xs text-slate-400 font-medium">{item.fornecedor_nome || 'Fornecedor Credenciado'}</span>
                          <h4 className="text-base font-bold text-slate-100">{item.nome_bruto}</h4>
                        </div>
                      </div>

                      {/* Sugestões */}
                      <div className="space-y-2">
                        {item.candidatos_json && item.candidatos_json.length > 0 ? (
                          item.candidatos_json.map((cand, cIdx) => (
                            <div key={cIdx} className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60 text-xs">
                              <div>
                                <span className="font-semibold text-slate-200">{cand.nome}</span>
                                <span className="ml-3 text-slate-400 font-mono">
                                  Confidence: {(cand.score * 100).toFixed(0)}% ({cand.motivos || 'Similaridade semântica'})
                                </span>
                              </div>
                              <button
                                onClick={() => handleVincular(item, cand.nome)}
                                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded transition"
                              >
                                ✓ Vincular Este
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500 italic">Nenhum candidato sugerido.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
