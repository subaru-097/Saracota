'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyBRL } from '@/lib/utils';
import { CheckCircle2, ChevronRight, ShoppingBag } from 'lucide-react';
import { FornecedorCotado } from '@/context/CotacoesContext';

export interface CardFornecedorProps {
  fornecedor: FornecedorCotado;
  onClick: () => void;
}

export const CardFornecedor: React.FC<CardFornecedorProps> = ({ fornecedor, onClick }) => {
  const totalVal = fornecedor.valorTotalGeral || 0;
  const itemCount = fornecedor.itensCotados?.length || 0;
  const nomeForn = fornecedor.nome || 'Fornecedor Credenciado';

  return (
    <Card
      variant="interactive"
      onClick={onClick}
      className="p-5 border-sara-border hover:border-brand/70 hover:shadow-glow transition-all cursor-pointer bg-sara-surface flex flex-col justify-between space-y-4 group rounded-2xl relative overflow-hidden"
    >
      {/* Top Header: Initial Avatar + Supplier Name & Status Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand font-bold flex items-center justify-center text-base border border-brand/30 shadow-inner group-hover:scale-105 transition-transform">
            {nomeForn[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-content-primary group-hover:text-brand transition-colors text-sm sm:text-base tracking-tight">
              {nomeForn}
            </h3>
            <p className="text-xs text-content-tertiary font-mono flex items-center gap-1.5 mt-0.5">
              <ShoppingBag className="w-3.5 h-3.5 text-content-tertiary" />
              {itemCount} {itemCount === 1 ? 'item cotado' : 'itens cotados'}
            </p>
          </div>
        </div>

        <Badge variant="emerald" size="sm" className="shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Concluída
        </Badge>
      </div>

      {/* Main Value Display */}
      <div className="p-3.5 rounded-xl bg-sara-elevated border border-sara-border/60 flex items-center justify-between font-mono">
        <div>
          <span className="text-[10px] text-content-tertiary uppercase font-bold tracking-wider block">
            Total do Pedido
          </span>
          <span className="text-lg sm:text-xl font-bold text-brand tracking-tight block mt-0.5">
            {formatCurrencyBRL(totalVal)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-brand font-medium group-hover:translate-x-1 transition-transform">
          <span>Ver detalhes</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </Card>
  );
};
