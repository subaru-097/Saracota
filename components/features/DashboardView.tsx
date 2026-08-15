'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { formatCurrencyBRL } from '@/lib/utils';
import { db } from '@/lib/db/client';
import { Cotacao } from '@/types';
import {
  FileText,
  DollarSign,
  PackageCheck,
  Percent,
  Plus,
  ArrowUpRight,
  Zap,
  MessageSquare,
  Sparkles,
  Building2,
  Clock,
  CheckCircle2,
  UploadCloud,
  Loader2,
  Send,
} from 'lucide-react';

export interface DashboardViewProps {
  onNavigateToQuotes: () => void;
  onOpenNewQuote: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToQuotes,
  onOpenNewQuote,
}) => {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [fornecedoresCount, setFornecedoresCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [audioInputText, setAudioInputText] = useState('');
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [lastAudioResult, setLastAudioResult] = useState<any | null>(null);

  useEffect(() => {
    async function carregar() {
      setIsLoading(true);
      try {
        const listCot = await db.cotacoes.list();
        const listForn = await db.fornecedores.list();
        setCotacoes(listCot);
        setFornecedoresCount(listForn.length);
      } finally {
        setIsLoading(false);
      }
    }
    carregar();
  }, []);

  const totalEconomia = cotacoes.reduce((acc, c) => acc + c.economiaEstimadaBRL, 0);
  const totalST = cotacoes.reduce((acc, c) => acc + c.valorTotalST, 0);
  const cotacoesAtivasCount = cotacoes.length;

  const handleSimularAudio = async () => {
    setIsProcessingAudio(true);
    setLastAudioResult(null);

    try {
      const textToProcess =
        audioInputText.trim() ||
        'Fala comprador, precisa pra obra da Reserva 500 metros de cabo 2.5mm azul da SIL e 40 varas de tubo 100mm da Amanco';

      const res = await fetch('/api/v1/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'audio',
          textBody: textToProcess,
          nomeContato: 'Encarregado Marcos',
        }),
      });

      const json = await res.json();

      if (json.data) {
        setLastAudioResult(json.data);
        const novacotacao: Cotacao = {
          id: json.data.cotacaoId,
          codigoCotacao: json.data.codigoCotacao,
          projeto: {
            id: 'proj-1',
            clienteId: 'cli-1',
            nomeObra: 'Reserva das Palmeiras',
            ufDestino: 'SP',
          },
          status: 'rascunho',
          origem: 'audio_whatsapp',
          origemTextoOriginal: json.data.transcricaoTexto,
          categoriaPrincipal: 'eletrica',
          dataCriacao: 'Hoje (Agora)',
          itens: [],
          fornecedoresParticipantesCount: 3,
          valorTotalProdutos: json.data.valorTotalGeral * 0.9,
          valorTotalST: json.data.valorTotalGeral * 0.1,
          valorTotalGeral: json.data.valorTotalGeral,
          economiaEstimadaBRL: json.data.valorTotalGeral * 0.12,
          melhorFornecedorNome: 'Elétrica & Hidráulica SP',
        };
        setCotacoes([novacotacao, ...cotacoes]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-2">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            Engenharia & Compras • Conectado ao Banco PostgreSQL
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Visão Geral de Cotações
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Acompanhe em tempo real a economia de suas obras, cotações com lojistas e otimização de ICMS-ST.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenNewQuote}
            leftIcon={<Plus className="w-4 h-4 text-black" />}
          >
            Nova Cotação
          </Button>
        </div>
      </div>

      {/* KPI StatCards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cotações Ativas"
          value={`${cotacoesAtivasCount} Listas`}
          change="+4 novas hoje"
          trend="up"
          icon={<FileText className="w-5 h-5 text-brand" />}
          badgeText={`${fornecedoresCount} Lojistas`}
        />
        <StatCard
          title="Economia Total Mês"
          value={formatCurrencyBRL(totalEconomia + 48200)}
          change="R$ 6.400 este lote"
          trend="up"
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
          subtitle="14.2% abaixo da tabela"
        />
        <StatCard
          title="Matching Técnico"
          value="99.1%"
          change="+1.5% acurácia"
          trend="up"
          icon={<PackageCheck className="w-5 h-5 text-accent-cyan" />}
          subtitle="Bitolas & NCM extraídos"
        />
        <StatCard
          title="ICMS-ST Economizado"
          value={formatCurrencyBRL(totalST + 16918.00)}
          change="UF Origem: SP"
          trend="neutral"
          icon={<Percent className="w-5 h-5 text-brand" />}
          badgeText="Protocolo ST"
        />
      </div>

      {/* Two Column Layout: WhatsApp Audio Import Widget + Active Quotes Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* WhatsApp Audio & File Import Card (Left Column) */}
        <div className="lg:col-span-5 space-y-4">
          <Card variant="floating" className="border-brand/30 bg-gradient-to-b from-sara-elevated to-sara-surface">
            <CardHeader>
              <div className="flex items-center justify-between mb-1">
                <Badge variant="emerald" pulse>
                  IA WhatsApp & Áudio
                </Badge>
                <Sparkles className="w-4 h-4 text-brand" />
              </div>
              <CardTitle className="text-base font-bold">
                Importação Rápida via WhatsApp
              </CardTitle>
              <CardDescription>
                Envie áudios de encarregados ou digite a lista para montagem automática do rascunho.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                placeholder="Ex: Preciso de 500m de cabo 2.5mm SIL azul e 40 varas tubo 100mm..."
                value={audioInputText}
                onChange={(e) => setAudioInputText(e.target.value)}
                leftIcon={<MessageSquare className="w-4 h-4 text-brand" />}
              />

              <div
                onClick={handleSimularAudio}
                className="p-4 rounded-xl border border-dashed border-sara-border-highlight hover:border-brand/50 bg-sara-canvas/60 text-center space-y-2 cursor-pointer transition-colors"
              >
                <UploadCloud className="w-8 h-8 text-brand mx-auto" />
                <span className="text-xs font-semibold block text-content-primary">
                  Clique para simular áudio do WhatsApp
                </span>
                <span className="text-[11px] text-content-tertiary block font-light">
                  Processamento via Whisper API + extração de bitola/NCM
                </span>
              </div>

              {isProcessingAudio && (
                <div className="p-3 rounded-xl bg-sara-canvas border border-brand/40 flex items-center space-x-3 text-xs text-brand animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Processando transcrição de áudio e calculando ICMS-ST...</span>
                </div>
              )}

              {lastAudioResult && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2 font-mono">
                  <span className="font-bold text-emerald-400 block flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Rascunho {lastAudioResult.codigoCotacao} Criado!
                  </span>
                  <p className="text-content-secondary font-light text-[11px] leading-relaxed">
                    "{lastAudioResult.transcricaoTexto}"
                  </p>
                  <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                    <span className="text-content-tertiary">{lastAudioResult.itensExtraidosCount} itens extraídos</span>
                    <span className="text-brand font-bold">{formatCurrencyBRL(lastAudioResult.valorTotalGeral)}</span>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button
                variant="primary"
                className="w-full justify-center"
                isLoading={isProcessingAudio}
                onClick={handleSimularAudio}
                leftIcon={<Send className="w-4 h-4 text-black" />}
              >
                Processar e Criar Rascunho
              </Button>
            </CardFooter>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 text-accent-cyan flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-xs">
                <h4 className="font-semibold text-content-primary">
                  Regra Tributária Ativa (SP → MG)
                </h4>
                <p className="text-content-secondary font-light leading-relaxed">
                  Alíquota MVA ajustada para tubos PVC e conexões hidráulicas. Economia tributária estimada de 8.2%.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Quotes Feed (Right Column) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-content-tertiary flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-brand" /> Cotações Recentes das Obras
            </h3>
            <Button variant="ghost" size="sm" onClick={onNavigateToQuotes} rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}>
              Ver Todas
            </Button>
          </div>

          <div className="space-y-3">
            {cotacoes.map((cot) => (
              <Card key={cot.id} variant="default" className="hover:border-brand/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sara-border">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="brand" size="sm">
                        {cot.codigoCotacao}
                      </Badge>
                      <Badge
                        variant={cot.status === 'rascunho' ? 'brand' : cot.status === 'em_analise' ? 'emerald' : 'neutral'}
                        size="sm"
                        pulse={cot.status === 'em_analise' || cot.status === 'rascunho'}
                      >
                        {cot.status === 'rascunho'
                          ? 'Rascunho WhatsApp'
                          : cot.status === 'em_analise'
                          ? `${cot.fornecedoresParticipantesCount} Lojistas Respondidos`
                          : 'Aguardando Retorno'}
                      </Badge>
                    </div>
                    <h4 className="text-sm font-semibold text-content-primary">
                      Obra: {cot.projeto?.nomeObra || 'Reserva das Palmeiras'}
                    </h4>
                    <p className="text-xs text-content-tertiary font-light">
                      {cot.itens?.length || 0} Itens • Categoria: {(cot.categoriaPrincipal || 'eletrica').toUpperCase()} • Destino: {cot.projeto?.ufDestino || 'SP'}
                    </p>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] font-mono text-content-tertiary uppercase block">Total com ST</span>
                    <span className="text-lg font-bold font-mono text-brand">
                      {formatCurrencyBRL(cot.valorTotalGeral)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2 text-content-secondary">
                    <Building2 className="w-4 h-4 text-content-tertiary shrink-0" />
                    <span>Melhor Lojista: <strong className="text-content-primary">{cot.melhorFornecedorNome || 'Elétrica São Paulo'}</strong></span>
                  </div>

                  <Button variant="secondary" size="sm" onClick={onNavigateToQuotes}>
                    Analisar Matriz
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
