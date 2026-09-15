/**
 * ETAPA 6: MODAL DE RESUMO DOS DADOS COTADOS — FORNECEDOR CONSTRUJÁ
 */

import React from 'react';
import { formatCurrencyBRL } from '@/lib/utils';

export interface ItemCotadoConstruja {
  id: string;
  nomeProduto: string;
  precoUnitario: number;
  quantidade: number;
  totalItem: number;
  status: 'CONFIRMADO' | 'NAO_ENCONTRADO';
}

export interface ModalDetalheConstrujaProps {
  isOpen: boolean;
  onClose: () => void;
  fornecedorNome: string;
  itens: ItemCotadoConstruja[];
  valorTotal: number;
}

export const ModalDetalheConstruja: React.FC<ModalDetalheConstrujaProps> = ({
  isOpen,
  onClose,
  fornecedorNome = 'Construjá',
  itens,
  valorTotal
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-bold text-slate-800">Resumo da Cotação — {fornecedorNome}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="my-4 max-h-96 overflow-y-auto space-y-3">
          {itens.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 border">
              <div>
                <p className="font-medium text-slate-900">{it.nomeProduto}</p>
                <p className="text-sm text-slate-500">{it.quantidade}x un • {formatCurrencyBRL(it.precoUnitario)} cada</p>
              </div>
              <div className="text-right">
                <span className="font-semibold text-emerald-700">{formatCurrencyBRL(it.totalItem)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-base font-medium text-slate-700">Total do Pedido Construjá</span>
          <span className="text-xl font-extrabold text-emerald-600">{formatCurrencyBRL(valorTotal)}</span>
        </div>
      </div>
    </div>
  );
};
