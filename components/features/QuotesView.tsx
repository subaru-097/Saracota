'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { formatCurrencyBRL } from '@/lib/utils';
import { useCotacoesSession } from '@/context/CotacoesContext';
import { useNotifications } from '@/context/NotificationContext';
import { exportCotacaoToPdf } from '@/lib/services/pdfExporter';
import { generateWhatsAppLink, cleanPhoneDigits } from '@/lib/utils/whatsapp';
import {
  Sparkles,
  Download,
  Building2,
  FileText,
  Search,
  Check,
  Award,
  Loader2,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';

export const QuotesView: React.FC = () => {
  const { cotacoesAtivas, cotacaoSelecionadaParaResultado, aprovarCotacaoSession } = useCotacoesSession();
  const { addNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [waSendingId, setWaSendingId] = useState<string | null>(null);

  const currentSessionQuote = cotacaoSelecionadaParaResultado || cotacoesAtivas[0];

  const handleExportPdfClick = async () => {
    if (!currentSessionQuote) {
      addNotification({
        title: 'Nenhuma Cotação Selecionada',
        description: 'Selecione uma cotação para exportar o relatório em PDF.',
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }

    setIsExportingPdf(true);
    try {
      const res = await exportCotacaoToPdf(currentSessionQuote, {
        filename: `Cotacao_${currentSessionQuote.codigo || 'SaraCota'}.pdf`,
      });

      if (res.success) {
        addNotification({
          title: 'PDF Gerado com Sucesso!',
          description: `Relatório da cotação ${currentSessionQuote.codigo} baixado em PDF.`,
          type: 'success',
          category: 'cotacao',
        });
      } else {
        addNotification({
          title: 'Falha ao Exportar PDF',
          description: res.errorMsg || 'Erro inesperado durante a geração do documento.',
          type: 'error',
          category: 'cotacao',
        });
      }
    } catch (err: any) {
      addNotification({
        title: 'Erro na Exportação',
        description: err.message || 'Ocorreu um erro ao processar o arquivo PDF.',
        type: 'error',
        category: 'cotacao',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleEnviarWhatsAppFornecedor = async (forn: any) => {
    let savedWa: string | null = forn.whatsapp || null;
    try {
      if (!savedWa && typeof window !== 'undefined') {
        savedWa = localStorage.getItem(`saracota_wa_${forn.id}`);
      }
    } catch (e) {
      console.warn('Falha ao obter WhatsApp do localStorage:', e);
    }

    if (!savedWa) {
      savedWa = '(11) 98765-4321'; // Fallback padrão
    }

    setWaSendingId(forn.id);
    try {
      // 1. Gerar o PDF da cotação
      await exportCotacaoToPdf(currentSessionQuote, {
        filename: `Cotacao_${currentSessionQuote?.codigo || 'SaraCota'}_${forn.nome.replace(/\s+/g, '_')}.pdf`,
      });

      // 2. Gerar link e abrir conversa no WhatsApp
      const waUrl = generateWhatsAppLink(savedWa, 'Quero negociar essa cotação.');
      if (typeof window !== 'undefined') {
        window.open(waUrl, '_blank');
      }

      // 3. Orientação visual amigável ao usuário
      addNotification({
        title: 'WhatsApp Aberto & PDF Baixado',
        description: `PDF da cotação salvo! Anexe o arquivo baixado na conversa do WhatsApp com ${forn.nome}.`,
        type: 'success',
        category: 'cotacao',
      });
    } catch (err: any) {
      addNotification({
        title: 'Falha no Envio por WhatsApp',
        description: err.message || 'Erro ao processar PDF antes da abertura do WhatsApp.',
        type: 'error',
        category: 'cotacao',
      });
    } finally {
      setWaSendingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Filter Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Matriz Comparativa Multi-Critério (Preço 50% + SLA 25% + Prazo 25%) • Banco Real
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Gerenciador de Cotações & Decision Engine
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Ranking automático de fornecedores credenciados com substituição tributária ICMS-ST no PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPdfClick}
            isLoading={isExportingPdf}
            leftIcon={isExportingPdf ? <Loader2 className="w-4 h-4 text-brand animate-spin" /> : <Download className="w-4 h-4" />}
          >
            Exportar PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (currentSessionQuote) {
                aprovarCotacaoSession(currentSessionQuote.id);
                addNotification({
                  title: 'Cotação Aprovada!',
                  description: `Proposta ${currentSessionQuote.codigo} atualizada no banco.`,
                  type: 'success',
                  category: 'cotacao',
                });
              }
            }}
            leftIcon={<FileText className="w-4 h-4 text-black" />}
          >
            Aprovar Cotação
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs
          items={[
            { id: 'todas', label: 'Todas as Cotações', count: cotacoesAtivas.length },
            { id: 'aguardando', label: 'Rascunhos', count: cotacoesAtivas.filter((c) => c.status === 'rascunho').length },
            { id: 'analise', label: 'Em Análise', count: cotacoesAtivas.filter((c) => c.status === 'em_analise').length },
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />

        <div className="w-full sm:w-72">
          <Input
            placeholder="Filtrar por NCM, SKU ou item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-content-tertiary" />}
          />
        </div>
      </div>

      {/* Card da Cotação Ativa em Exibição Envolvido em ErrorBoundary */}
      <ErrorBoundary>
        {currentSessionQuote && (
          <div className="space-y-6">
            <Card variant="floating" className="border-brand/40 bg-sara-elevated">
              <CardHeader className="border-b border-sara-border pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center font-mono font-bold text-sm">
                      {currentSessionQuote.codigo}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        Obra: {currentSessionQuote.obra}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono">
                        Criada em: {currentSessionQuote.dataCriacao} • Protocolo Banco Real
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="emerald" size="sm" pulse>
                      {currentSessionQuote.status.toUpperCase()}
                    </Badge>
                    <Badge variant="brand" size="sm">
                      Economia Estimada: {formatCurrencyBRL(currentSessionQuote.economiaEstimadaBRL || 0)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                <h3 className="text-sm font-bold text-content-primary flex items-center gap-2">
                  <Award className="w-4 h-4 text-brand" /> Ranking Comparativo de Lojistas
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {currentSessionQuote.fornecedores.map((forn) => {
                    let savedWa: string | null = forn.whatsapp || null;
                    try {
                      if (!savedWa && typeof window !== 'undefined') {
                        savedWa = localStorage.getItem(`saracota_wa_${forn.id}`);
                      }
                    } catch (e) {
                      console.warn('Erro localStorage:', e);
                    }
                    const hasWa = Boolean(savedWa);

                    return (
                      <Card
                        key={forn.id}
                        variant={forn.isVencedor ? 'default' : 'bordered'}
                        className={`flex flex-col justify-between ${
                          forn.isVencedor ? 'border-brand shadow-card' : ''
                        }`}
                      >
                        <CardHeader className="pb-3 border-b border-sara-border">
                          <div className="flex items-center justify-between mb-2">
                            <Badge
                              variant={
                                forn.matchingStatus === 'exato'
                                  ? 'emerald'
                                  : forn.matchingStatus === 'similar'
                                  ? 'brand'
                                  : 'rose'
                              }
                              size="sm"
                            >
                              {forn.matchingStatus === 'exato'
                                ? 'Match Exato'
                                : forn.matchingStatus === 'similar'
                                ? 'Match Similar'
                                : 'Indisponível'}
                            </Badge>
                            <span className="text-xs font-mono text-amber-400 font-bold">★ {forn.score}</span>
                          </div>

                          <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-brand" /> {forn.nome}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono">
                            Prazo de Entrega: {forn.prazoDias} dias
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="pt-3 space-y-2 text-xs font-mono">
                          <div className="flex justify-between text-content-secondary">
                            <span>Produtos:</span>
                            <span>{formatCurrencyBRL(forn.valorProdutos)}</span>
                          </div>
                          <div className="flex justify-between text-accent-cyan">
                            <span>ICMS-ST Retido:</span>
                            <span>{formatCurrencyBRL(forn.valorST)}</span>
                          </div>
                          <div className="pt-2 border-t border-sara-border flex justify-between font-bold text-sm text-brand">
                            <span>Total com ST:</span>
                            <span>{formatCurrencyBRL(forn.valorTotalGeral)}</span>
                          </div>

                          {/* Status de WhatsApp do Fornecedor */}
                          <div className="pt-2">
                            {hasWa ? (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                <MessageCircle className="w-3 h-3 text-emerald-400" /> Whats: {savedWa}
                              </span>
                            ) : (
                              <span className="text-[10px] text-content-tertiary flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-400" /> Cadastre o WhatsApp do fornecedor em Ajustes para habilitar o envio.
                              </span>
                            )}
                          </div>
                        </CardContent>

                        <CardFooter className="pt-3 border-t border-sara-border flex flex-col gap-2">
                          {/* Botão de Envio WhatsApp */}
                          {hasWa ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full justify-center text-xs font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              onClick={() => handleEnviarWhatsAppFornecedor(forn)}
                              isLoading={waSendingId === forn.id}
                              leftIcon={<MessageCircle className="w-3.5 h-3.5 text-emerald-400" />}
                            >
                              Enviar Cotação via WhatsApp
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full justify-center text-xs font-light opacity-60 cursor-not-allowed"
                              disabled
                              title="Cadastre o WhatsApp do fornecedor em Ajustes para habilitar o envio"
                              leftIcon={<MessageCircle className="w-3.5 h-3.5 text-content-tertiary" />}
                            >
                              WhatsApp Não Cadastrado
                            </Button>
                          )}

                          <Button
                            variant={forn.isVencedor ? 'primary' : 'secondary'}
                            size="sm"
                            className="w-full justify-center"
                            onClick={() => {
                              aprovarCotacaoSession(currentSessionQuote.id);
                              addNotification({
                                title: 'Cotação Aprovada!',
                                description: `Fornecedor ${forn.nome} selecionado com sucesso.`,
                                type: 'success',
                                category: 'cotacao',
                              });
                            }}
                            leftIcon={<Check className="w-4 h-4 text-black" />}
                          >
                            {forn.isVencedor ? 'Aprovar Esta Cotação' : 'Selecionar Fornecedor'}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
};
