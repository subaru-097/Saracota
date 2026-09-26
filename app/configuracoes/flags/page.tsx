'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/db/client';

export interface FeatureFlagsCliente {
  auto_substituir_equivalente: boolean;
  aceitar_embalagem_multipla: boolean;
  permitir_matching_semantico_nivel2: boolean;
  notificar_pendencia_whatsapp: boolean;
}

export default function FeatureFlagsConfigPage() {
  const [flags, setFlags] = useState<FeatureFlagsCliente>({
    auto_substituir_equivalente: true,
    aceitar_embalagem_multipla: true,
    permitir_matching_semantico_nivel2: true,
    notificar_pendencia_whatsapp: true,
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    carregarFlags();
  }, []);

  async function carregarFlags() {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('configuracoes_cliente').select('*').limit(1).maybeSingle();
      if (data) {
        setFlags({
          auto_substituir_equivalente: data.auto_substituir_equivalente ?? true,
          aceitar_embalagem_multipla: data.aceitar_embalagem_multipla ?? true,
          permitir_matching_semantico_nivel2: data.permitir_matching_semantico_nivel2 ?? true,
          notificar_pendencia_whatsapp: data.notificar_pendencia_whatsapp ?? true,
        });
      }
    } catch (err) {
      console.warn('Erro ao carregar configuracoes_cliente:', err);
    }
  }

  async function handleToggle(key: keyof FeatureFlagsCliente) {
    const novasFlags = { ...flags, [key]: !flags[key] };
    setFlags(novasFlags);
  }

  async function handleSalvar() {
    setSaving(true);
    try {
      if (supabase) {
        const { data: clientRecord } = await supabase.from('clientes').select('id').limit(1).maybeSingle();
        const clienteId = clientRecord?.id || '00000000-0000-0000-0000-000000000001';

        await supabase.from('configuracoes_cliente').upsert([
          {
            cliente_id: clienteId,
            ...flags,
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      setMensagem('✅ Configurações de Feature Flags salvas com sucesso!');
      setTimeout(() => setMensagem(null), 4000);
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0c0e] text-slate-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-lg text-xl">⚙️</span>
            Painel de Feature Flags por Cliente
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Configure o comportamento dos algoritmos da Saratoga para suas cotações. Por padrão, todas as automações estão ativadas para garantir máxima economia e agilidade.
          </p>
        </header>

        {mensagem && (
          <div className="mb-6 p-4 bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 rounded-xl text-sm font-medium">
            {mensagem}
          </div>
        )}

        <div className="grid gap-6 mb-8">
          {/* Flag 1 */}
          <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                🔄 Auto-substituir por Marca Equivalente
                <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono">Padrão: Ativado</span>
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Quando a marca exata solicitada não estiver disponível no catálogo do fornecedor, o motor selecionará automaticamente uma marca equivalente de mesma categoria técnica (ex: Fortlev ~ Tigre ~ Amanco), sem travar a cotação.
              </p>
            </div>
            <button
              onClick={() => handleToggle('auto_substituir_equivalente')}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition duration-300 ${
                flags.auto_substituir_equivalente ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
            </button>
          </div>

          {/* Flag 2 */}
          <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                📦 Aceitar Embalagem Múltipla do Fornecedor
                <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono">Padrão: Ativado</span>
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Arredonda a quantidade do item para a próxima caixa ou pacote fechado exigido pelo distribuidor, garantindo a aprovação da compra no carrinho.
              </p>
            </div>
            <button
              onClick={() => handleToggle('aceitar_embalagem_multipla')}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition duration-300 ${
                flags.aceitar_embalagem_multipla ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
            </button>
          </div>

          {/* Flag 3 */}
          <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                ⚡ Matching Semântico e Vetorial (Nível 2)
                <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono">Padrão: Ativado</span>
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Autoriza o motor a realizar o vínculo inteligente entre descrições com variações de texto quando os atributos técnicos críticos coincidirem.
              </p>
            </div>
            <button
              onClick={() => handleToggle('permitir_matching_semantico_nivel2')}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition duration-300 ${
                flags.permitir_matching_semantico_nivel2 ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
            </button>
          </div>

          {/* Flag 4 */}
          <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                💬 Notificações de Pendência via WhatsApp
                <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono">Padrão: Ativado</span>
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Dispara um alerta automático no WhatsApp cadastrado quando uma cotação gerar itens na Fila de Pendências de Nível 3 para aprovação rápida.
              </p>
            </div>
            <button
              onClick={() => handleToggle('notificar_pendencia_whatsapp')}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition duration-300 ${
                flags.notificar_pendencia_whatsapp ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition shadow-lg flex items-center gap-2"
          >
            {saving ? 'Salvando...' : '💾 Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
}
