'use client';

import React, { useState, useEffect } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ParsedPastedItem } from '@/lib/utils/parseMultiItemPaste';
import { Plus, Minus, Trash2, ClipboardCheck, Sparkles } from 'lucide-react';

export interface MultiItemPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (items: ParsedPastedItem[]) => void;
  initialItems: ParsedPastedItem[];
}

export const MultiItemPasteModal: React.FC<MultiItemPasteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialItems,
}) => {
  const [items, setItems] = useState<ParsedPastedItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setItems(initialItems.map((it) => ({ ...it })));
    }
  }, [isOpen, initialItems]);

  const handleUpdateQtd = (id: string, newQtd: number) => {
    const validQtd = Math.max(1, newQtd);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantidade: validQtd } : it))
    );
  };

  const handleUpdateNome = (id: string, newNome: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, nomeProduto: newNome } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleConfirmAction = () => {
    const validItems = items.filter((it) => it.nomeProduto.trim().length > 0);
    onConfirm(validItems);
    onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar Itens Colados da Lista"
      description={`Detectamos ${items.length} ${items.length === 1 ? 'item colado' : 'itens colados'}. Revise a quantidade e descrição antes de adicionar.`}
      className="sm:max-w-2xl sm:w-full"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full pt-1 font-mono">
          <span className="text-content-tertiary text-xs">
            Total a adicionar: <strong className="text-brand font-bold">{items.length} {items.length === 1 ? 'item' : 'itens'}</strong>
          </span>

          <div className="flex items-center justify-end gap-2.5">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmAction}
              disabled={items.length === 0}
              leftIcon={<Sparkles className="w-4 h-4 text-black" />}
            >
              Adicionar {items.length} {items.length === 1 ? 'Item' : 'Itens'} à Lista
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs font-mono">
        {/* Banner Informativo */}
        <div className="p-3.5 rounded-xl bg-brand/10 border border-brand/30 text-brand flex items-center gap-3">
          <ClipboardCheck className="w-5 h-5 text-brand shrink-0" />
          <div>
            <p className="font-bold text-xs">Parser de Colagem Multilinha Ativado</p>
            <p className="text-[11px] text-content-secondary mt-0.5">
              O sistema extraiu as quantidades e separou os nomes dos materiais. Você pode ajustar qualquer valor abaixo antes de salvar no rascunho.
            </p>
          </div>
        </div>

        {/* Lista Editável de Itens Colados */}
        {items.length > 0 ? (
          <div className="border border-sara-border rounded-xl overflow-hidden bg-sara-surface max-h-[380px] overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-sara-elevated border-b border-sara-border text-content-tertiary text-[11px] sticky top-0 z-10">
                <tr>
                  <th className="p-3 font-semibold text-center w-28">Quantidade</th>
                  <th className="p-3 font-semibold">Descrição do Material</th>
                  <th className="p-3 font-semibold text-center w-12">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sara-border/50">
                {items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-sara-hover/50 transition-colors">
                    {/* Stepper de Quantidade */}
                    <td className="p-2.5 text-center">
                      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-sara-elevated border border-sara-border">
                        <button
                          type="button"
                          onClick={() => handleUpdateQtd(it.id, it.quantidade - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded text-content-secondary hover:text-brand hover:bg-sara-hover transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={it.quantidade}
                          onChange={(e) => handleUpdateQtd(it.id, parseInt(e.target.value, 10) || 1)}
                          className="w-10 text-center font-bold text-xs bg-transparent text-brand focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQtd(it.id, it.quantidade + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded text-content-secondary hover:text-brand hover:bg-sara-hover transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Nome do Produto Editável */}
                    <td className="p-2.5">
                      <Input
                        value={it.nomeProduto}
                        onChange={(e) => handleUpdateNome(it.id, e.target.value)}
                        className="text-xs h-9 bg-sara-elevated/80 border-sara-border/80 focus:border-brand"
                        placeholder="Nome do produto"
                      />
                    </td>

                    {/* Botão de Excluir */}
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        className="p-1.5 rounded-lg text-content-tertiary hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remover este item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-content-tertiary">
            <p>Nenhum item restante na lista.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
};
