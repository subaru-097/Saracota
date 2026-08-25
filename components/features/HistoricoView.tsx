'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sheet } from '@/components/ui/Sheet';
import { formatCurrencyBRL } from '@/lib/utils';
import { useCotacoesSession } from '@/context/CotacoesContext';
import { useNotifications } from '@/context/NotificationContext';
import { exportCotacaoToPdf } from '@/lib/services/pdfExporter';
import { db } from '@/lib/db/client';
import {
  Clock,
  TrendingDown,
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  PackageOpen,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Check,
  Ban,
  Trash2,
} from 'lucide-react';

export const HistoricoView: React.FC = () => {
  const {
    cotacoesHistorico,
    isLoadingHistorico,
    errorHistorico,
    carregarHistoricoDoBanco,
    economiaAcumuladaTotal,
  } = useCotacoesSession();

  const [usuarioRole, setUsuarioRole] = useState<'proprietario' | 'colaborador'>('proprietario');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('saracota_user_role');
      if (saved === 'colaborador' || saved === 'proprietario') {
        setUsuarioRole(saved);
      }
    }
  }, []);

  const { addNotification } = useNotifications();

  const [periodoFiltro, setPeriodoFiltro] = useState('30dias');
  const [fornecedorFiltro, setFornecedorFiltro] = useState('todos');
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Estados para Acordeão de Matching e Modal de Revisão
  const [expandedCotacaoId, setExpandedCotacaoId] = useState<string | null>(null);
  const [matchingItensMap, setMatchingItensMap] = useState<Record<string, any[]>>({});
  const [itemParaRevisar, setItemParaRevisar] = useState<any | null>(null);
  const [cotacaoIdEmRevisao, setCotacaoIdEmRevisao] = useState<string | null>(null);
  const [isUpdatingMatching, setIsUpdatingMatching] = useState(false);

  useEffect(() => {
    carregarHistoricoDoBanco(fornecedorFiltro);
  }, [fornecedorFiltro, carregarHistoricoDoBanco]);

  // Carregar itens de matching quando expandir uma cotação
  const toggleExpandCotacao = async (cotacaoId: string) => {
    if (expandedCotacaoId === cotacaoId) {
      setExpandedCotacaoId(null);
      return;
    }

    setExpandedCotacaoId(cotacaoId);
    if (!matchingItensMap[cotacaoId]) {
      const itens = await db.cotacoes.obterResultadosMatching(cotacaoId);
      setMatchingItensMap((prev) => ({ ...prev, [cotacaoId]: itens }));
    }
  };

  const handleExportPdfHistorico = async (cot: any) => {
    setExportingId(cot.id);
    try {
      const res = await exportCotacaoToPdf(cot, {
        filename: `Comprovante_Cotacao_${cot.codigo || 'SaraCota'}.pdf`,
      });

      if (res.success) {
        addNotification({
          title: 'PDF Baixado com Sucesso',
          description: `Comprovante da cotação ${cot.codigo} exportado em PDF.`,
          type: 'success',
          category: 'cotacao',
        });
      } else {
        addNotification({
          title: 'Erro na Exportação',
          description: res.errorMsg || 'Não foi possível gerar o PDF.',
          type: 'error',
          category: 'cotacao',
        });
      }
    } catch (err: any) {
      addNotification({
        title: 'Erro na Exportação',
        description: err.message || 'Falha ao processar o PDF.',
        type: 'error',
        category: 'cotacao',
      });
    } finally {
      setExportingId(null);
    }
  };

  // Decisão manual do usuário: Aceitar este produto (CONFIRMADO) ou Ignorar (IGNORADO)
  const handleDecidirItem = async (novoStatus: 'CONFIRMADO' | 'IGNORADO') => {
    if (!itemParaRevisar || !cotacaoIdEmRevisao) return;

    setIsUpdatingMatching(true);
    try {
      await db.cotacoes.atualizarStatusMatchingItem(
        cotacaoIdEmRevisao,
        itemParaRevisar.fornecedorId || 'forn-1',
        itemParaRevisar.itemPedido,
        novoStatus
      );

      // Recarregar lista de matching daquela cotação
      const itensAtualizados = await db.cotacoes.obterResultadosMatching(cotacaoIdEmRevisao);
      setMatchingItensMap((prev) => ({ ...prev, [cotacaoIdEmRevisao]: itensAtualizados }));

      const confirmadosCount = itensAtualizados.filter((i) => i.status === 'CONFIRMADO').length;
      const pendentesCount = itensAtualizados.filter(
        (i) => i.status === 'SIMILAR' || i.status === 'NAO_ENCONTRADO'
      ).length;

      addNotification({
        title: novoStatus === 'CONFIRMADO' ? 'Item Confirmado!' : 'Item Ignorado',
        description: `Status de "${itemParaRevisar.itemPedido}" alterado com sucesso. (${confirmadosCount} confirmados, ${pendentesCount} em revisão)`,
        type: novoStatus === 'CONFIRMADO' ? 'success' : 'info',
        category: 'cotacao',
      });

      // Se não houver mais pendentes de revisão, notifica a conclusão global da cotação
      if (pendentesCount === 0) {
        addNotification({
          title: '🎉 Cotação Concluída!',
          description: `Todos os itens da cotação foram validados com sucesso!`,
          type: 'success',
          category: 'cotacao',
        });
        carregarHistoricoDoBanco(fornecedorFiltro);
      }
    } catch (e: any) {
      addNotification({
        title: 'Erro ao Atualizar',
        description: e.message || 'Não foi possível atualizar a decisão do item.',
        type: 'error',
        category: 'cotacao',
      });
    } finally {
      setIsUpdatingMatching(false);
      setItemParaRevisar(null);
    }
  };

  const totalHistorico = cotacoesHistorico.reduce((acc, c) => acc + c.valorTotalGeral, 0);
  const evolucaoPrecosMock = [
    { mes: 'Mai', valor: 45000, altura: '45%' },
    { mes: 'Jun', valor: 52000, altura: '60%' },
    { mes: 'Jul', valor: 68000, altura: '85%' },
    { mes: 'Ago (Banco)', valor: Math.round(totalHistorico) || 41000, altura: '95%' },
  ];

  const renderStatusBadgeGeral = (status: string) => {
    switch (status) {
      case 'concluida':
      case 'aprovada':
        return (
          <Badge variant="emerald" size="sm" className="font-semibold">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Concluída
          </Badge>
        );
      case 'aguardando_revisao':
        return (
          <Badge variant="neutral" size="sm" className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" /> Aguardando Revisão
          </Badge>
        );
      case 'pendente':
      case 'em_analise':
        return (
          <Badge variant="brand" size="sm" className="font-semibold">
            <Clock className="w-3 h-3 mr-1 animate-spin" /> Pendente (RPA)
          </Badge>
        );
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const isProprietario = usuarioRole === 'proprietario';

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-2">
            <Clock className="w-3.5 h-3.5" />
            Sara Cota • Central de Cotações & Matching Automatizado
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Histórico & Central de Revisão
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Acompanhe a cotação por robôs RPA, revise itens com similaridade e confirme pedidos.
          </p>
        </div>
      </div>

      {/* Gráfico Simples de Evolução de Preço */}
      <Card variant="default">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-400" /> Evolução do Custo Mensal das Obras
            </CardTitle>
            <Badge variant="emerald" size="sm" className="font-mono">
              Economia Acumulada: {formatCurrencyBRL(economiaAcumuladaTotal)}
            </Badge>
          </div>
          <CardDescription>
            Comparativo de gastos e economia recalculado com base nas cotações processadas.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="h-36 flex items-end justify-between gap-4 px-4 pb-2 border-b border-sara-border font-mono text-xs">
            {evolucaoPrecosMock.map((bar) => (
              <div key={bar.mes} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[10px] text-content-tertiary group-hover:text-brand font-bold transition-colors">
                  {formatCurrencyBRL(bar.valor)}
                </span>
                <div
                  style={{ height: bar.altura }}
                  className="w-full max-w-[48px] bg-gradient-to-t from-amber-600/40 via-brand to-amber-300 rounded-t-lg transition-all group-hover:brightness-125 shadow-glow"
                />
                <span className="text-[11px] text-content-secondary font-semibold">{bar.mes}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtros em Tempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Filtrar por Período"
          value={periodoFiltro}
          onChange={(e) => setPeriodoFiltro(e.target.value)}
          leftIcon={<Calendar className="w-4 h-4 text-content-tertiary" />}
        >
          <option value="30dias">Últimos 30 Dias</option>
          <option value="90dias">Últimos 90 Dias</option>
          <option value="ano">Ano Atual (2026)</option>
        </Select>

        <Select
          label="Filtrar por Lojista"
          value={fornecedorFiltro}
          onChange={(e) => setFornecedorFiltro(e.target.value)}
          leftIcon={<Building2 className="w-4 h-4 text-content-tertiary" />}
        >
          <option value="todos">Todos os Fornecedores</option>
          <option value="elétrica">Elétrica São Paulo</option>
          <option value="hidráulica">Hidráulica & Elétrica Central</option>
        </Select>
      </div>

      {/* ESTADO 1: LOADING STATE */}
      {isLoadingHistorico && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} variant="bordered" className="p-4 space-y-2">
              <Skeleton variant="text" className="w-1/3 h-5" />
              <Skeleton variant="text" className="w-1/4 h-4" />
            </Card>
          ))}
        </div>
      )}

      {/* ESTADO 2: ERROR STATE */}
      {!isLoadingHistorico && errorHistorico && (
        <Card variant="bordered" className="p-8 text-center space-y-4 border-rose-500/40 bg-rose-500/5">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-content-primary">Falha ao Buscar Histórico</h3>
            <p className="text-xs text-content-secondary font-light mt-1 max-w-md mx-auto">
              {errorHistorico}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => carregarHistoricoDoBanco(fornecedorFiltro)}
            leftIcon={<RefreshCw className="w-4 h-4 text-brand" />}
          >
            Tentar Novamente
          </Button>
        </Card>
      )}

      {/* ESTADO 3: EMPTY STATE */}
      {!isLoadingHistorico && !errorHistorico && cotacoesHistorico.length === 0 && (
        <Card variant="bordered" className="p-8 text-center space-y-4 bg-sara-surface">
          <PackageOpen className="w-12 h-12 text-brand mx-auto opacity-80" />
          <div>
            <h3 className="text-base font-bold text-content-primary">Nenhuma Cotação no Histórico</h3>
            <p className="text-xs text-content-secondary font-light mt-1 max-w-md mx-auto">
              Crie novas cotações para enviá-las aos portais B2B dos fornecedores cadastrados.
            </p>
          </div>
          <Link href="/cotacoes">
            <Button variant="primary" size="md">
              Ir para Bloco de Cotações
            </Button>
          </Link>
        </Card>
      )}

      {/* ESTADO 4: DADOS REAIS DO HISTÓRICO COM MATCHING DETALHADO */}
      {!isLoadingHistorico && !errorHistorico && cotacoesHistorico.length > 0 && (
        <div className="space-y-4">
          <span className="text-xs font-mono text-content-tertiary uppercase block">
            Cotações Registradas ({cotacoesHistorico.length}):
          </span>

          <div className="space-y-3">
            {cotacoesHistorico.map((cot) => {
              const isExpanded = expandedCotacaoId === cot.id;
              const matchingItens = matchingItensMap[cot.id] || [];

              return (
                <Card
                  key={cot.id}
                  variant="bordered"
                  className="overflow-hidden transition-all border-sara-border hover:border-brand/40"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sara-surface">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="brand" size="sm">
                          {cot.codigo}
                        </Badge>
                        <span className="text-sm font-bold text-content-primary">
                          {cot.obra}
                        </span>
                        {renderStatusBadgeGeral(cot.status)}
                      </div>
                      <p className="text-xs text-content-tertiary font-mono">
                        Lojista Principal: {cot.fornecedorVencedorNome || 'Multi-Fornecedores'} • {cot.dataCriacao}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-content-tertiary uppercase block">Valor Geral</span>
                        <span className="font-bold text-content-primary">{formatCurrencyBRL(cot.valorTotalGeral)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-emerald-400 uppercase block font-bold">Economia</span>
                        <span className="text-emerald-400 font-bold">+{formatCurrencyBRL(cot.economiaEstimadaBRL)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleExpandCotacao(cot.id)}
                          rightIcon={isExpanded ? <ChevronUp className="w-4 h-4 text-brand" /> : <ChevronDown className="w-4 h-4 text-brand" />}
                        >
                          {isExpanded ? 'Ocultar Itens' : 'Ver Itens & Matching'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportPdfHistorico(cot)}
                          isLoading={exportingId === cot.id}
                          title="Baixar Comprovante PDF"
                        >
                          <Download className="w-4 h-4 text-brand" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* PAINEL EXPANSÍVEL: ITENS DA COTAÇÃO & MATCHING DOS ROBÔS */}
                  {isExpanded && (
                    <div className="p-4 border-t border-sara-border bg-sara-bg/60 space-y-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono font-bold uppercase text-content-secondary flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-brand" /> Resultado do Matching por Item:
                        </h4>
                        <span className="text-[11px] text-content-tertiary font-mono">
                          {matchingItens.length} item(ns) analisado(s)
                        </span>
                      </div>

                      {matchingItens.length === 0 ? (
                        <div className="p-4 text-center text-xs text-content-tertiary font-mono">
                          Carregando itens de matching...
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {matchingItens.map((item, idx) => {
                            const isConfirmado = item.status === 'CONFIRMADO';
                            const isSimilar = item.status === 'SIMILAR';
                            const isNaoEncontrado = item.status === 'NAO_ENCONTRADO' || item.status === 'IGNORADO';

                            return (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs transition-colors ${
                                  isConfirmado
                                    ? 'bg-emerald-500/5 border-emerald-500/30'
                                    : isSimilar
                                    ? 'bg-amber-500/5 border-amber-500/30'
                                    : 'bg-rose-500/5 border-rose-500/30'
                                }`}
                              >
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    {isConfirmado && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                                    {isSimilar && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />}
                                    {isNaoEncontrado && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}

                                    <span className="font-bold text-content-primary">
                                      {item.itemPedido}
                                    </span>

                                    <Badge
                                      variant={isConfirmado ? 'emerald' : isSimilar ? 'neutral' : 'rose'}
                                      size="sm"
                                      className={isSimilar ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : ''}
                                    >
                                      {isConfirmado
                                        ? 'CONFIRMADO'
                                        : isSimilar
                                        ? `SIMILAR (${item.confianca}% Match)`
                                        : 'NÃO ENCONTRADO'}
                                    </Badge>
                                  </div>

                                  {item.produtoEncontrado && (
                                    <p className="text-[11px] text-content-secondary pl-6">
                                      Lojista: <strong className="text-content-primary">{item.produtoEncontrado}</strong>
                                      {item.preco > 0 && (
                                        <span className="ml-2 text-emerald-400 font-bold">
                                          • {formatCurrencyBRL(item.preco)}
                                        </span>
                                      )}
                                    </p>
                                  )}
                                </div>

                                {/* Botão de Revisão para itens duvidosos ou similares */}
                                {(isSimilar || isNaoEncontrado) && (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => {
                                        setItemParaRevisar(item);
                                        setCotacaoIdEmRevisao(cot.id);
                                      }}
                                    >
                                      Revisar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL / SHEET DE REVISÃO DE ITEM (PROMPT 13) */}
      <Sheet
        isOpen={!!itemParaRevisar}
        onClose={() => setItemParaRevisar(null)}
        title="Revisão Manual de Produto"
      >
        {itemParaRevisar && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-sara-bg border border-sara-border space-y-1">
              <span className="text-[10px] text-content-tertiary uppercase font-mono block font-bold">
                Item Solicitado pelo Usuário:
              </span>
              <h3 className="text-sm font-bold text-content-primary">
                {itemParaRevisar.itemPedido}
              </h3>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Produto Similar Localizado pelo Robô:
                </span>
                <Badge variant="neutral" size="sm" className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono">
                  {itemParaRevisar.confianca || 65}% de Similaridade Textual
                </Badge>
              </div>

              <div className="flex items-start gap-3">
                {itemParaRevisar.imagem ? (
                  <img
                    src={itemParaRevisar.imagem}
                    alt={itemParaRevisar.produtoEncontrado}
                    className="w-16 h-16 object-cover rounded-lg border border-sara-border shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-sara-surface border border-sara-border flex items-center justify-center shrink-0 text-content-tertiary">
                    <PackageOpen className="w-8 h-8" />
                  </div>
                )}

                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-bold text-content-primary">
                    {itemParaRevisar.produtoEncontrado || 'Produto Genérico Encontrado'}
                  </h4>
                  <p className="text-sm font-mono font-bold text-emerald-400">
                    {itemParaRevisar.preco > 0 ? formatCurrencyBRL(itemParaRevisar.preco) : 'Preço sob consulta'}
                  </p>
                </div>
              </div>

              {itemParaRevisar.link && (
                <a
                  href={itemParaRevisar.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline font-mono pt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir Link Direto do Produto no Portal do Lojista
                </a>
              )}
            </div>

            {/* Opções de Decisão Manual */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => handleDecidirItem('IGNORADO')}
                isLoading={isUpdatingMatching}
                leftIcon={<Ban className="w-4 h-4 text-rose-400" />}
                className="w-full sm:w-auto text-rose-400 hover:text-rose-300"
              >
                Ignorar este fornecedor para este item
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={() => handleDecidirItem('CONFIRMADO')}
                isLoading={isUpdatingMatching}
                leftIcon={<Check className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Aceitar este produto (Confirmar)
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
};
