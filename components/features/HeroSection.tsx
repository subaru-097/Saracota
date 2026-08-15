'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Sparkles,
  LayoutDashboard,
  FileText,
  Building2,
  Clock,
  Settings,
  ArrowRight,
  Zap,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Hero Banner Section */}
      <div className="relative p-6 sm:p-10 rounded-3xl sara-glass border border-sara-border-highlight bg-gradient-to-b from-sara-elevated via-sara-surface to-sara-canvas overflow-hidden shadow-floating">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono">
            <Zap className="w-3.5 h-3.5" />
            Sara Cota SaaS • Cotação Inteligente com IA & ICMS-ST
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-content-primary leading-tight">
            Plataforma SaaS para Cotação de <span className="text-brand">Materiais de Construção</span>
          </h1>

          <p className="text-sm sm:text-base text-content-secondary font-light leading-relaxed">
            Conecte engenheiros, encarregados e lojistas. Transcreva áudios do WhatsApp, extraia atributos técnicos e compare preços com substituição tributária automatizada.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* CTA 1: Começar a Cotar -> /cotacoes */}
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

            {/* CTA 2: Acessar Painel -> /painel */}
            <Link href="/painel" className="cursor-pointer">
              <Button
                variant="secondary"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="text-sm"
              >
                Acessar Painel
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Grid de Seções Clicáveis (As 5 Áreas do App) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-content-tertiary flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand" /> Navegação pelas Seções do Aplicativo
          </h2>
          <span className="text-xs text-content-tertiary font-mono">
            Clique em qualquer seção para acessar
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Painel -> /painel */}
          <Link href="/painel" className="block group cursor-pointer">
            <Card
              variant="interactive"
              className="h-full flex flex-col justify-between group-hover:border-brand/50 transition-all"
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <Badge variant="brand" size="sm">
                    Painel
                  </Badge>
                </div>
                <CardTitle className="text-base group-hover:text-brand transition-colors">
                  1. Painel Geral
                </CardTitle>
                <CardDescription className="text-xs">
                  Visão consolidada das obras, seletor de CNPJ ativo, totais economizados e cotações recentes.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 flex items-center justify-between text-xs font-mono text-brand">
                <span>Acessar Painel</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>

          {/* Card 2: Cotações -> /cotacoes */}
          <Link href="/cotacoes" className="block group cursor-pointer">
            <Card
              variant="interactive"
              className="h-full flex flex-col justify-between group-hover:border-brand/50 transition-all"
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <Badge variant="emerald" size="sm">
                    Cotações
                  </Badge>
                </div>
                <CardTitle className="text-base group-hover:text-brand transition-colors">
                  2. Central de Cotações
                </CardTitle>
                <CardDescription className="text-xs">
                  Montagem por texto/áudio, matriz comparativa entre lojistas e apuração de ICMS-ST por item.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 flex items-center justify-between text-xs font-mono text-emerald-400">
                <span>Ir para Cotações</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>

          {/* Card 3: Fornecedores -> /fornecedores */}
          <Link href="/fornecedores" className="block group cursor-pointer">
            <Card
              variant="interactive"
              className="h-full flex flex-col justify-between group-hover:border-brand/50 transition-all"
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-accent-cyan flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <Badge variant="cyan" size="sm">
                    Fornecedores
                  </Badge>
                </div>
                <CardTitle className="text-base group-hover:text-brand transition-colors">
                  3. Rede de Fornecedores
                </CardTitle>
                <CardDescription className="text-xs">
                  Lojistas credenciados, portais B2B, status da sessão de login e teste de conexão.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 flex items-center justify-between text-xs font-mono text-accent-cyan">
                <span>Ver Fornecedores</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>

          {/* Card 4: Histórico -> /historico */}
          <Link href="/historico" className="block group cursor-pointer">
            <Card
              variant="interactive"
              className="h-full flex flex-col justify-between group-hover:border-brand/50 transition-all"
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                  <Badge variant="brand" size="sm">
                    Histórico
                  </Badge>
                </div>
                <CardTitle className="text-base group-hover:text-brand transition-colors">
                  4. Histórico & Auditoria
                </CardTitle>
                <CardDescription className="text-xs">
                  Lista de cotações passadas, gráfico de evolução de preços dos materiais e economia em R$.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 flex items-center justify-between text-xs font-mono text-amber-400">
                <span>Consultar Histórico</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>

          {/* Card 5: Ajustes -> /ajustes */}
          <Link href="/ajustes" className="block group cursor-pointer">
            <Card
              variant="interactive"
              className="h-full flex flex-col justify-between group-hover:border-brand/50 transition-all"
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-content-secondary flex items-center justify-center font-bold">
                    <Settings className="w-5 h-5" />
                  </div>
                  <Badge variant="neutral" size="sm">
                    Ajustes
                  </Badge>
                </div>
                <CardTitle className="text-base group-hover:text-brand transition-colors">
                  5. Ajustes & Integrações
                </CardTitle>
                <CardDescription className="text-xs">
                  Perfil do comprador, CNPJs cadastrados e status visual das integrações com WhatsApp e ERPs.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 flex items-center justify-between text-xs font-mono text-content-secondary">
                <span>Abrir Configurações</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};
