'use client';

import React from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { formatCurrencyBRL } from '@/lib/utils';
import { FornecedorCotado } from '@/context/CotacoesContext';
import { exportCotacaoToPdf } from '@/lib/services/pdfExporter';
import {
  ExternalLink,
  Download,
  ShoppingCart,
  FileCheck,
  Sparkles,
  Package,
} from 'lucide-react';

export interface ModalDetalheFornecedorProps {
  fornecedor: FornecedorCotado | null;
  isOpen: boolean;
  onClose: () => void;
  obraNome?: string;
}

export const ModalDetalheFornecedor: React.FC<ModalDetalheFornecedorProps> = ({
  fornecedor,
  isOpen,
  onClose,
  obraNome = 'Reserva das Palmeiras',
}) => {
  if (!fornecedor) return null;

  const nomeForn = fornecedor.nome || 'Fornecedor Credenciado';
  const cartUrl = fornecedor.urlCarrinhoDireto || 'https://www.cicalfer.com.br/carrinho';
  const itens = fornecedor.itensCotados || [];
  const valProdutos = fornecedor.valorProdutos || 0;
  const valST = fornecedor.valorST || 0;
  const valTotal = fornecedor.valorTotalGeral || 0;

  const handleProsseguirFornecedor = () => {
    if (typeof window !== 'undefined') {
      window.open(cartUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSalvarPdf = () => {
    exportCotacaoToPdf({
      codigo: `#${Date.now().toString().substring(7)}`,
      obra: obraNome,
      fornecedorVencedorNome: nomeForn,
      valorTotalGeral: valTotal,
      dataCriacao: new Date().toLocaleDateString('pt-BR'),
      itens: itens.map((it) => ({
        material: { nome: it.nomeEncontrado || it.nomeSolicitado, unidade: it.unidade || 'un' },
        quantidade: it.quantidade,
      })),
      fornecedores: [fornecedor],
    });
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Resultado da Cotação — ${nomeForn}`}
      description="Carrinho de materiais com resumo dos itens, preço unitário e valor total do pedido."
      className="sm:max-w-3xl sm:w-full"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full pt-1 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-content-tertiary text-xs sm:text-sm">Valor Total do Pedido:</span>
            <span className="font-bold text-brand text-lg sm:text-xl tracking-tight">
              {formatCurrencyBRL(valTotal)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              variant="primary"
              size="md"
              className="flex-1 sm:flex-initial shadow-glow"
              onClick={handleProsseguirFornecedor}
              leftIcon={<ExternalLink className="w-4 h-4 text-black" />}
            >
              Prosseguir para o fornecedor
            </Button>

            <Button
              variant="secondary"
              size="md"
              className="flex-1 sm:flex-initial"
              onClick={handleSalvarPdf}
              leftIcon={<Download className="w-4 h-4 text-content-primary" />}
            >
              Salvar PDF
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs font-mono">
        {/* CARDS DE RESUMO: SUBTOAL PRODUTOS E TOTAL DO PEDIDO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-sara-surface border border-sara-border flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between text-content-tertiary">
              <span className="text-[11px] font-mono font-medium uppercase tracking-wider">Subtotal Produtos</span>
              <ShoppingCart className="w-4 h-4 text-content-tertiary opacity-70" />
            </div>
            <p className="text-base sm:text-lg font-bold font-mono text-content-primary">
              {formatCurrencyBRL(valProdutos)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-brand/10 border border-brand/40 flex flex-col justify-between space-y-1.5 shadow-glow">
            <div className="flex items-center justify-between text-brand">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Total do Pedido</span>
              <Sparkles className="w-4 h-4 text-brand" />
            </div>
            <p className="text-lg sm:text-xl font-bold font-mono text-brand">
              {formatCurrencyBRL(valTotal)}
            </p>
          </div>
        </div>

        {/* TABELA DE PRODUTOS EXTRAÍDOS DO SITE DO FORNECEDOR */}
        <div className="space-y-2">
          <div className="flex items-center justify-between font-bold text-content-primary text-xs pt-1">
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4 text-brand" /> Itens do Carrinho ({nomeForn}):
            </span>
            <span className="text-content-tertiary font-mono text-[11px]">
              {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="border border-sara-border rounded-xl overflow-hidden bg-sara-surface">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-sara-elevated border-b border-sara-border text-content-tertiary text-[11px]">
                <tr>
                  <th className="p-3 font-bold uppercase tracking-wider">Nome do Produto (Extraído do Site)</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-center">Qtd</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-right">Preço Unitário</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-right">Preço Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sara-border/60">
                {itens.length > 0 ? (
                  itens.map((it, idx) => {
                    const nomeExibido = it.nomeEncontrado || it.nomeSolicitado || 'Produto';
                    const unitPrice = it.precoUnitario || 0;
                    const qtd = it.quantidade || 1;
                    const subtotalItem = Number((unitPrice * qtd).toFixed(2));

                    return (
                      <tr key={it.itemId || idx} className="hover:bg-sara-hover/50 transition-colors">
                        <td className="p-3 font-medium text-content-primary">
                          <span className="text-sm font-bold text-content-primary leading-snug block">
                            {nomeExibido}
                          </span>
                        </td>
                        <td className="p-3 text-center text-content-secondary font-bold font-mono">
                          {qtd} {it.unidade || 'un'}
                        </td>
                        <td className="p-3 text-right text-content-secondary font-mono">
                          {formatCurrencyBRL(unitPrice)}
                        </td>
                        <td className="p-3 text-right font-bold text-brand font-mono">
                          {formatCurrencyBRL(subtotalItem)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-content-tertiary font-mono">
                      Nenhum item localizado no carrinho deste fornecedor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Sheet>
  );
};
