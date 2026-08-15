'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import { BottomNav } from '@/components/layout/BottomNav';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toast } from '@/components/ui/Toast';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  DollarSign,
  Calculator,
  Building2,
  Package,
  Layers,
  ArrowRight,
  Send,
  Zap,
} from 'lucide-react';

export default function DesignSystemShowcasePage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const { addToast, toasts, removeToast } = useToast();

  const handleToastClick = (type: 'success' | 'warning' | 'error' | 'info') => {
    const payloads = {
      success: {
        title: 'Cotação Aprovada com Sucesso!',
        description: 'Fornecedor Amanco Brasil atendeu todos os critérios de menor preço e ST.',
      },
      warning: {
        title: 'Aviso de Prazo de Entrega',
        description: 'SIL Fios solicitou extensão de 2 dias no prazo da cotação.',
      },
      error: {
        title: 'Erro na Consulta Tributária',
        description: 'NCM 8544.49.00 não possui protocolo ST entre SP e MG.',
      },
      info: {
        title: 'Nova Tabela de Preços',
        description: 'Atualizada a tabela do fornecedor Votorantim Cimentos.',
      },
    };
    addToast({ ...payloads[type], type });
  };

  return (
    <AppShell activeTab={activeTab} onChangeTab={setActiveTab}>
      {/* Toast Render Area */}
      <div className="fixed top-16 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onDismiss={removeToast} />
          </div>
        ))}
      </div>

      <div className="space-y-10 pb-16">
        {/* Header Header */}
        <div className="pb-4 border-b border-sara-border space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            Sara Cota • Component Showcase (/app/design-system)
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Biblioteca de Componentes Base de UI
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light max-w-3xl">
            Todos os 8 componentes exigidos foram implementados utilizando 100% dos design tokens centralizados.
          </p>
        </div>

        {/* 1. BUTTON SHOWCASE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" /> 1. Button (Todas as Variantes, Estados e Tamanhos)
            </h2>
            <span className="text-xs text-content-tertiary font-mono">Component: Button.tsx</span>
          </div>

          <Card variant="bordered" className="space-y-6">
            {/* Variantes principais */}
            <div className="space-y-2">
              <span className="text-xs text-content-secondary font-medium block">Variantes de Estilo:</span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" leftIcon={<Sparkles className="w-4 h-4 text-black" />}>
                  Primary (Laranja Âmbar)
                </Button>
                <Button variant="secondary" leftIcon={<Plus className="w-4 h-4" />}>
                  Secondary (Outline)
                </Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive" leftIcon={<Trash2 className="w-4 h-4" />}>
                  Destructive
                </Button>
                <Button variant="cyan" leftIcon={<Send className="w-4 h-4 text-black" />}>
                  Cyan Accent
                </Button>
              </div>
            </div>

            {/* Tamanhos sm, md, lg, icon */}
            <div className="space-y-2">
              <span className="text-xs text-content-secondary font-medium block">Tamanhos (sm, md, lg, icon):</span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="sm">
                  Small (sm)
                </Button>
                <Button variant="primary" size="md">
                  Medium (md)
                </Button>
                <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4 text-black" />}>
                  Large (lg)
                </Button>
                <Button variant="secondary" size="icon">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Estados: Loading, Disabled, Touch feedback */}
            <div className="space-y-2">
              <span className="text-xs text-content-secondary font-medium block">Estados (Loading, Disabled, Touch Active Feedback):</span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" isLoading>
                  Carregando
                </Button>
                <Button variant="primary" disabled>
                  Desabilitado
                </Button>
                <Button variant="secondary" disabled>
                  Outline Desabilitado
                </Button>
                <span className="text-xs text-content-tertiary self-center font-mono">
                  [ Toque/Clique no botão para ver o feedback tátil active:scale-[0.97] ]
                </span>
              </div>
            </div>
          </Card>
        </section>

        {/* 2. INPUT / TEXTFIELD SHOWCASE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" /> 2. Input / TextField (Com Labels, Ícones, Erro e Fonte Mono)
            </h2>
            <span className="text-xs text-content-tertiary font-mono">Component: Input.tsx</span>
          </div>

          <Card variant="bordered" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome do Produto / SKU"
              placeholder="Ex: Cabo Flexível SIL 750V 2.5mm²"
              leftIcon={<Search className="w-4 h-4 text-content-tertiary" />}
              helperText="Digite a descrição ou código técnico do produto."
            />

            <Input
              label="Valor Monetário da Cotação (Fonte Mono)"
              placeholder="R$ 0,00"
              isMono
              leftIcon={<DollarSign className="w-4 h-4 text-brand" />}
              defaultValue="R$ 14.850,00"
            />

            <Input
              label="Campo com Estado de Erro"
              placeholder="Digite a quantidade..."
              error="Quantidade mínima de compra deve ser maior que zero."
              defaultValue="-5"
              isMono
            />

            <Input
              label="Campo Desabilitado"
              placeholder="Valor calculated automaticamente"
              disabled
              defaultValue="ICMS-ST Isento via Protocolo 41/2008"
            />
          </Card>
        </section>

        {/* 3. CARD SHOWCASE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" /> 3. Card Flutuante (Header, Corpo e Rodapé)
            </h2>
            <span className="text-xs text-content-tertiary font-mono">Component: Card.tsx</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card variant="default">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="brand">Cotação #9482</Badge>
                  <span className="text-xs font-mono text-content-tertiary">SP → MG</span>
                </div>
                <CardTitle className="text-base mt-1">
                  Residencial Villa Flora - Etapa Hidráulica
                </CardTitle>
                <CardDescription>
                  Amanco Brasil • 40 varas Tubo Esgoto 100mm
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-content-secondary space-y-1">
                <p>Valor Total dos Produtos: <strong className="text-content-primary font-mono font-bold">R$ 2.756,00</strong></p>
                <p>ICMS-ST Retido: <strong className="text-emerald-400 font-mono font-bold">R$ 216,00 (Calculado)</strong></p>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="text-xs text-content-tertiary">Status: Aguardando Lojista</span>
                <Button variant="primary" size="sm">Ver Detalhes</Button>
              </CardFooter>
            </Card>

            <Card variant="interactive">
              <CardHeader>
                <Badge variant="cyan">Variante Interativa (Hover Glow)</Badge>
                <CardTitle className="text-base mt-1">
                  Card Selecionável com Hover sutil
                </CardTitle>
                <CardDescription>
                  Passe o mouse ou toque para testar o efeito de borda e brilho âmbar.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-content-secondary">
                Este card responde ao hover e foco com destaque na cor de acento do tema.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 4. BADGE / TAG SHOWCASE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" /> 4. Badge / Tag (Cores Semânticas)
            </h2>
            <span className="text-xs text-content-tertiary font-mono">Component: Badge.tsx</span>
          </div>

          <Card variant="bordered" className="flex flex-wrap items-center gap-3">
            <Badge variant="emerald" pulse>Aprovado</Badge>
            <Badge variant="brand" pulse>Em Cotação</Badge>
            <Badge variant="cyan">ICMS-ST Calculado</Badge>
            <Badge variant="rose">Déficit de Estoque</Badge>
            <Badge variant="neutral">Rascunho</Badge>
          </Card>
        </section>

        {/* 5. MODAL / BOTTOM SHEET SHOWCASE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" /> 5. Modal / Bottom Sheet Responsivo
            </h2>
            <span className="text-xs text-content-tertiary font-mono">Component: Sheet.tsx</span>
          </div>

          <Card variant="bordered" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-content-primary">
                Testar Comportamento Híbrido (Mobile vs Desktop)
              </h3>
              <p className="text-xs text-content-secondary font-light">
                No celular, sobe de baixo como Bottom Sheet nativo com handle de arraste. No desktop, centraliza como Modal.
              </p>
            </div>
            <Button variant="primary" onClick={() => setIsSheetOpen(true)} leftIcon={<Layers className="w-4 h-4 text-black" />}>
              Abrir Bottom Sheet / Modal
            </Button>
          </Card>
        </section>

        {/* 6. NAVBAR / TAB BAR INFERIOR MOBILE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" /> 6. Navbar / Tab Bar Inferior Mobile (Mínimo 44px Touch Target)
            </h2>
            <span className="text-xs text-content-tertiary font-mono">Component: BottomNav.tsx</span>
          </div>

          <Card variant="bordered" className="space-y-2">
            <p className="text-xs text-content-secondary font-light">
              Demonstração da barra fixa inferior ativa no mobile (visível fixada no rodapé em telas pequenas ou renderizada abaixo):
            </p>
            <div className="p-2 bg-sara-canvas border border-sara-border rounded-xl">
              <div className="flex items-center justify-around h-[64px] sara-glass rounded-lg px-2">
                <button className="flex flex-col items-center text-brand text-[10px] font-semibold">
                  <Package className="w-5 h-5 text-brand" />
                  <span>Painel</span>
                </button>
                <button className="flex flex-col items-center text-content-tertiary text-[10px]">
                  <Calculator className="w-5 h-5" />
                  <span>Cotações</span>
                </button>
                <button className="flex flex-col items-center text-content-tertiary text-[10px]">
                  <Building2 className="w-5 h-5" />
                  <span>Fornecedores</span>
                </button>
              </div>
            </div>
          </Card>
        </section>

        {/* 7. SKELETON LOADER SHOWCASE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" /> 7. Skeleton Loader (Efeito Shimmer Sutil)
            </h2>
            <span className="text-xs text-content-tertiary font-mono">Component: Skeleton.tsx</span>
          </div>

          <Card variant="bordered" className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowSkeleton(!showSkeleton)}>
                {showSkeleton ? 'Ocultar Skeleton' : 'Alternar Estado de Carregamento'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 p-4 bg-sara-surface rounded-xl border border-sara-border">
                <Skeleton variant="text" className="w-3/4" />
                <Skeleton variant="rectangular" className="h-8" />
                <Skeleton variant="text" className="w-1/2" />
              </div>
              <div className="space-y-2 p-4 bg-sara-surface rounded-xl border border-sara-border">
                <Skeleton variant="text" className="w-2/3" />
                <Skeleton variant="rectangular" className="h-8" />
                <Skeleton variant="text" className="w-1/3" />
              </div>
              <div className="space-y-2 p-4 bg-sara-surface rounded-xl border border-sara-border">
                <Skeleton variant="text" className="w-4/5" />
                <Skeleton variant="rectangular" className="h-8" />
                <Skeleton variant="text" className="w-2/5" />
              </div>
            </div>
          </Card>
        </section>

        {/* 8. TOAST / NOTIFICATION SHOWCASE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" /> 8. Toast / Notification (Auto-dismiss & Semântica)
            </h2>
            <span className="text-xs text-content-tertiary font-mono">Component: Toast.tsx</span>
          </div>

          <Card variant="bordered" className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm" onClick={() => handleToastClick('success')}>
              Testar Sucesso
            </Button>
            <Button variant="cyan" size="sm" onClick={() => handleToastClick('info')}>
              Testar Informação
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleToastClick('warning')}>
              Testar Aviso
            </Button>
            <Button variant="destructive" size="sm" onClick={() => handleToastClick('error')}>
              Testar Erro
            </Button>
          </Card>
        </section>
      </div>

      {/* Interactive Sheet Component */}
      <Sheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Demonstração do Modal / Bottom Sheet"
        description="Em telas de celular, este modal sobe da parte inferior com puxador (handle) nativo."
        footer={
          <Button variant="primary" onClick={() => setIsSheetOpen(false)}>
            Confirmar e Fechar
          </Button>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-content-secondary font-light">
            Este componente ajusta automaticamente a experiência entre dispositivos móveis e desktop, garantindo máxima usabilidade para encarregados em obra ou compradores no computador.
          </p>
          <div className="p-3 bg-sara-elevated rounded-xl border border-sara-border space-y-1 font-mono text-[11px]">
            <span className="text-brand font-bold block">Mobile: Bottom Sheet (sobe do fundo)</span>
            <span className="text-accent-cyan font-bold block">Desktop: Modal Dialog (centralizado)</span>
          </div>
        </div>
      </Sheet>
    </AppShell>
  );
}
