/**
 * ETAPA 1: BOOT DA COTAÇÃO — SARA COTA
 * 
 * Trechos extraídos de components/features/CotacoesView.tsx
 * Responsável por gerenciar a entrada de itens pelo usuário, seleção dos fornecedores com RPA ativo
 * e disparo da cotação automatizada.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/db/client';
import { ItemRascunho, Fornecedor } from '@/types';

export const BootCotacaoExemplo: React.FC = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [itensRascunho, setItensRascunho] = useState<ItemRascunho[]>([]);
  const [obraNomeInput, setObraNomeInput] = useState('Reserva das Palmeiras');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Helper para verificar se o fornecedor possui automação RPA ativa (Ex: Cicalfer)
  const temAutomacaoRpaDisponivel = useCallback((forn: { id: string; nome: string }): boolean => {
    if (!forn) return false;
    const normId = (forn.id || '').toLowerCase();
    const normNome = (forn.nome || '').toLowerCase();
    return normId.includes('33e03495') || normId.includes('cicalfer') || normNome.includes('cicalfer');
  }, []);

  // 2. Carregar fornecedores do banco e auto-selecionar os que possuem RPA ativo por padrão
  const carregarFornecedores = useCallback(async () => {
    try {
      const lista = await db.fornecedores.list();
      setFornecedores(lista);
      const apenasRpa = lista.filter(temAutomacaoRpaDisponivel).map((f) => f.id);
      setSelectedSupplierIds(apenasRpa);
    } catch (e) {
      console.warn('Erro ao carregar fornecedores:', e);
    }
  }, [temAutomacaoRpaDisponivel]);

  useEffect(() => {
    carregarFornecedores();
  }, [carregarFornecedores]);

  // 3. Função acionada pelo botão "Cotar Selecionados"
  const handleConfirmEnviarCotacaoFornecedores = async () => {
    if (isSubmitting) return;

    if (selectedSupplierIds.length === 0) {
      alert('Selecione pelo menos um fornecedor para cotar!');
      return;
    }

    setIsSubmitting(true);

    try {
      // 3a. Criar cotação no banco de dados da Sara Cota
      const novaCotacao = await db.cotacoes.criar({
        obra: obraNomeInput,
        itens: itensRascunho,
        fornecedorIds: selectedSupplierIds,
      });

      const cotacaoId = novaCotacao?.id;
      if (!cotacaoId) throw new Error('Falha ao obter ID da cotação.');

      // 3b. Disparar a requisição HTTP POST para iniciar o processamento em segundo plano no servidor Node.js
      const resProcess = await fetch(`/api/cotacoes/${cotacaoId}/processar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: itensRascunho,
          fornecedorIds: selectedSupplierIds,
        }),
      });

      const dataProcess = await resProcess.json();

      if (!resProcess.ok || !dataProcess || dataProcess.sucesso === false) {
        throw new Error(dataProcess?.mensagem || 'Falha ao iniciar a automação RPA no servidor.');
      }

      console.log('🚀 Automação RPA iniciada com sucesso:', dataProcess);

      // 3c. Iniciar Polling de progresso via GET /api/cotacoes/[cotacaoId]/status
      // (Ver arquivo 05_retorno_dados/route_processar_e_status.ts)

    } catch (err: any) {
      console.error('Erro ao disparar cotação:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h3>Boot da Cotação — Sara Cota</h3>
      <button onClick={handleConfirmEnviarCotacaoFornecedores} disabled={isSubmitting}>
        {isSubmitting ? 'Iniciando Robô...' : 'Cotar com Cicalfer'}
      </button>
    </div>
  );
};
