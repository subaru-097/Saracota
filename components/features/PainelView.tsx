'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyBRL } from '@/lib/utils';
import { useCotacoesSession } from '@/context/CotacoesContext';
import {
  Plus,
  FileText,
  Building2,
  Clock,
  ArrowRight,
  Sparkles,
  Zap,
  PlusCircle,
  History,
} from 'lucide-react';

export interface PainelViewProps {
  onNavigateTab?: (tabId: string) => void;
  onOpenNovaCotacao?: () => void;
}

export const PainelView: React.FC<PainelViewProps> = ({
  onNavigateTab = () => {},
  onOpenNovaCotacao,
}) => {
  const { cotacoesAtivas } = useCotacoesSession();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-2">
            <Zap className="w-3.5 h-3.5" />
            Sara Cota SaaS • Painel da Obra
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Painel Geral de Compras
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Gestão de listas de materiais de construção, elétrica e hidráulica.
          </p>
        </div>

        {/* Botão Destaque: Começar a Cotar */}
        <Link href="/cotacoes" className="cursor-pointer">
          <Button
            variant="primary"
            size="lg"
            leftIcon={<Sparkles className="w-5 h-5 text-black" />}
            className="shadow-glow font-bold text-sm"
          >
            Começar a Cotar
          </Button>
        </Link>
      </div>

      {/* Atalhos Rápidos Clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/fornecedores" className="block cursor-pointer">
          <Card
            variant="interactive"
            className="p-4 flex items-center justify-between cursor-pointer border-sara-border-highlight hover:border-brand/40"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-content-primary">Adicionar Fornecedor</h3>
                <p className="text-xs text-content-secondary font-light">Credenciar novos lojistas ou fornecedores regionais.</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-brand" />
          </Card>
        </Link>

        <Link href="/historico" className="block cursor-pointer">
          <Card
            variant="interactive"
            className="p-4 flex items-center justify-between cursor-pointer border-sara-border-highlight hover:border-brand/40"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-accent-cyan flex items-center justify-center font-bold">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-content-primary">Ver Histórico de Cotações</h3>
                <p className="text-xs text-content-secondary font-light">Consultar comparativos passados e evolução de preços.</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-accent-cyan" />
          </Card>
        </Link>
      </div>

      {/* Cards de Cotações Recentes Dinâmicos da Sessão */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-content-tertiary flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand" /> Cotações Ativas na Sessão ({cotacoesAtivas.length})
          </h3>
          <Link href="/cotacoes" className="cursor-pointer">
            <Button variant="ghost" size="sm">
              Ver Todas
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cotacoesAtivas.map((cot) => (
            <Link key={cot.id} href="/cotacoes" className="block cursor-pointer">
              <Card variant="default" className="flex flex-col justify-between hover:border-brand/40 transition-colors h-full">
                <CardHeader className="pb-3 border-b border-sara-border">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="brand" size="sm">
                      {cot.codigo}
                    </Badge>
                    <Badge variant={cot.status === 'em_analise' ? 'brand' : 'emerald'} size="sm">
                      {cot.status === 'em_analise' ? 'Em Cotação' : 'Aprovada'}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{cot.obra}</CardTitle>
                  <CardDescription className="text-xs">
                    {cot.itens.length} itens • {cot.dataCriacao}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-3 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center text-content-secondary">
                    <span>Lojista Principal:</span>
                    <strong className="text-content-primary font-sans">{cot.fornecedorVencedorNome}</strong>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-sara-border/50">
                    <span className="text-content-tertiary">Valor Total:</span>
                    <span className="text-base font-bold text-brand">{formatCurrencyBRL(cot.valorTotalGeral)}</span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-sara-border">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-between"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Abrir Cotação
                  </Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
