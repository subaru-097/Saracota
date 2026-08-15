'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Toast';
import { useNotifications } from '@/context/NotificationContext';
import { Search, Sparkles, Building2, Package } from 'lucide-react';

export interface AppShellProps {
  children: React.ReactNode;
  activeTab?: string;
  onChangeTab?: (id: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab = 'dashboard',
  onChangeTab = () => {},
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { activeToast, dismissToast, addNotification } = useNotifications();

  const handleSimularNovaCotacaoSubmit = () => {
    setIsNewQuoteOpen(false);
    addNotification({
      title: 'Nova Cotação de Obra Criada',
      description: 'Cotação iniciada com sucesso. O motor ICMS-ST e os lojistas foram notificados.',
      type: 'success',
      category: 'cotacao',
      linkTab: 'quotes',
    });
  };

  return (
    <div className="min-h-screen bg-sara-canvas text-content-primary flex flex-col font-sans">
      {/* Toast Notification Container Overlay */}
      {activeToast && (
        <div className="fixed top-16 right-4 z-50 pointer-events-auto">
          <Toast toast={activeToast} onDismiss={dismissToast} />
        </div>
      )}

      {/* Header Fixo com Notificações */}
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNewQuote={() => setIsNewQuoteOpen(true)}
        onNavigateTab={onChangeTab}
      />

      {/* Main Body with Sidebar */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        <Sidebar activeTab={activeTab} onChangeTab={onChangeTab} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} onChangeTab={onChangeTab} />

      {/* Global Search Sheet / Modal */}
      <Sheet
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        title="Busca Global & Cotação Rápida"
        description="Pesquise por nome do item, bitola, SKU técnico ou fornecedor cadastrado."
      >
        <div className="space-y-4">
          <Input
            placeholder="Ex: Cabo Flexível 2.5mm, Tubo PVC 100mm, Disjuntor 50A..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-brand" />}
            autoFocus
          />

          <div className="space-y-2">
            <span className="text-xs font-mono text-content-tertiary uppercase">
              Buscas Frequentes em Obras:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'Cabo Flexível SIL 2.5mm²',
                'Tubo PVC Esgoto 100mm Amanco',
                'Cimento CP II 50kg Votoran',
                'Conduíte Corrugado 3/4"',
              ].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setSearchQuery(term)}
                  className="px-2.5 py-1 bg-sara-surface hover:bg-sara-hover border border-sara-border text-xs rounded-lg text-content-secondary transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Sheet>

      {/* New Quote Sheet / Modal */}
      <Sheet
        isOpen={isNewQuoteOpen}
        onClose={() => setIsNewQuoteOpen(false)}
        title="Iniciar Nova Cotação"
        description="Selecione o cliente ou obra e adicione os itens para cotação automatizada."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsNewQuoteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSimularNovaCotacaoSubmit}
              leftIcon={<Sparkles className="w-4 h-4 text-black" />}
            >
              Criar Lista de Cotação
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">
              Nome da Obra ou Projeto
            </label>
            <Input
              placeholder="Ex: Residenciais Reserva das Palmeiras - Bloco B"
              leftIcon={<Building2 className="w-4 h-4 text-content-tertiary" />}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">
              Categoria Principal dos Materiais
            </label>
            <Select leftIcon={<Package className="w-4 h-4 text-content-tertiary" />}>
              <option value="eletrica">Materiais Elétricos & Iluminação</option>
              <option value="hidraulica">Tubos, Conexões & Hidráulica</option>
              <option value="estrutura">Cimento, Ferragem & Estrutura</option>
              <option value="acabamento">Tintas & Acabamento</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">
              Estado de Destino (UF para ICMS-ST)
            </label>
            <Select>
              <option value="SP">São Paulo (SP)</option>
              <option value="MG">Minas Gerais (MG)</option>
              <option value="RJ">Rio de Janeiro (RJ)</option>
              <option value="PR">Paraná (PR)</option>
            </Select>
          </div>
        </form>
      </Sheet>
    </div>
  );
};
