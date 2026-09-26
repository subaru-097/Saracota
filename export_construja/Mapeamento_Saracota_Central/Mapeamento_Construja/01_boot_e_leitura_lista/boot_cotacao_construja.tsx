/**
 * ETAPA 1: BOOT DA COTAÇÃO — SARA COTA (FORNECEDOR CONSTRUJÁ)
 * 
 * Lógica de inicialização do rascunho, seleção da Construjá (ID: a1684c4d-d896-4ba9-a591-cda455c5ffe2)
 * e disparo do processamento assíncrono.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/db/client';
import { ItemRascunho, Fornecedor } from '@/types';

export const CONSTRUJA_FORNECEDOR_ID = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';

export const BootCotacaoConstruja: React.FC = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([CONSTRUJA_FORNECEDOR_ID]);
  const [itensRascunho, setItensRascunho] = useState<ItemRascunho[]>([]);
  const [obraNomeInput, setObraNomeInput] = useState('Reserva das Palmeiras');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper para verificar se o fornecedor é a Construjá com RPA ativo
  const isConstrujaRpa = useCallback((forn: { id: string; nome: string }): boolean => {
    if (!forn) return false;
    const normId = (forn.id || '').toLowerCase();
    const normNome = (forn.nome || '').toLowerCase();
    return normId.includes('a1684c4d') || normNome.includes('construja');
  }, []);

  const carregarFornecedores = useCallback(async () => {
    try {
      const lista = await db.fornecedores.list();
      setFornecedores(lista);
      const construjaOnly = lista.filter(isConstrujaRpa).map((f) => f.id);
      setSelectedSupplierIds(construjaOnly.length > 0 ? construjaOnly : [CONSTRUJA_FORNECEDOR_ID]);
    } catch (e) {
      console.warn('Erro ao carregar fornecedores:', e);
    }
  }, [isConstrujaRpa]);

  useEffect(() => {
    carregarFornecedores();
  }, [carregarFornecedores]);

  const handleConfirmEnviarCotacaoConstruja = async () => {
    if (isSubmitting) return;
    if (itensRascunho.length === 0) return;

    setIsSubmitting(true);
    try {
      // 1. Criar cotação no banco
      const novaCotacao = await db.cotacoes.create({
        obraNome: obraNomeInput,
        itens: itensRascunho,
        fornecedorIds: [CONSTRUJA_FORNECEDOR_ID],
        fornecedores_selecionados: [CONSTRUJA_FORNECEDOR_ID],
      });

      const cotacaoId = novaCotacao?.id;
      if (!cotacaoId) throw new Error('Falha ao gerar ID da cotação.');

      // 2. Disparar processamento assíncrono via API POST
      const res = await fetch(`/api/cotacoes/${cotacaoId}/processar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: itensRascunho,
          fornecedorIds: [CONSTRUJA_FORNECEDOR_ID],
        }),
      });

      const data = await res.json();
      console.log('🚀 Automação Construjá iniciada:', data);
    } catch (err) {
      console.error('Erro ao iniciar cotação Construjá:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h3>Boot da Cotação — Construjá</h3>
      <button onClick={handleConfirmEnviarCotacaoConstruja} disabled={isSubmitting}>
        {isSubmitting ? 'Iniciando Robô...' : 'Cotar com Construjá'}
      </button>
    </div>
  );
};
