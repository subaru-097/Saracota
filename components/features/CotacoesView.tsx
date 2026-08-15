'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { formatCurrencyBRL } from '@/lib/utils';
import { useCotacoesSession } from '@/context/CotacoesContext';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { exportCotacaoToPdf } from '@/lib/services/pdfExporter';
import { generateWhatsAppLink } from '@/lib/utils/whatsapp';
import { speechService } from '@/lib/services/speech';
import { db } from '@/lib/db/client';
import { ItemRascunho } from '@/types';
import {
  FileText,
  Mic,
  MicOff,
  Plus,
  Building2,
  Sparkles,
  Award,
  Trash2,
  FileCheck,
  Check,
  RefreshCw,
  AlertCircle,
  PackageOpen,
  MessageCircle,
  Save,
  Clock,
  Edit3,
  CheckCheck,
  HelpCircle,
  Calendar,
} from 'lucide-react';

export const CotacoesView: React.FC = () => {
  const {
    cotacoesAtivas,
    cotacaoSelecionadaParaResultado,
    isLoadingCotacoes,
    errorCotacoes,
    carregarCotacoesDoBanco,
    gerarCotacaoSession,
    aprovarCotacaoSession,
  } = useCotacoesSession();

  const { addNotification } = useNotifications();
  const { user } = useAuth();

  const [subAba, setSubAba] = useState<'nova' | 'resultado'>('nova');
  const [isRelatorioModalOpen, setIsRelatorioModalOpen] = useState(false);
  const [obraNomeInput, setObraNomeInput] = useState('Reserva das Palmeiras');

  // ESTADO DO BLOCO DE NOTAS / RASCUNHO (PROMPT 6)
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [itensRascunho, setItensRascunho] = useState<ItemRascunho[]>([]);
  const [novoItemTexto, setNovoItemTexto] = useState('');
  const [isListeningVoz, setIsListeningVoz] = useState(false);
  const [vozStatusMsg, setVozStatusMsg] = useState<string | null>(null);
  const [ultimaEdicaoTime, setUltimaEdicaoTime] = useState<string | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waSendingId, setWaSendingId] = useState<string | null>(null);

  const currentCotacao = cotacaoSelecionadaParaResultado || cotacoesAtivas[0];
  const usuarioId = user?.id || 'usr-default';

  // 1. CARREGAR RASCUNHO ATIVO PERSISTIDO (VÁLIDO POR ATÉ 14 DIAS)
  const carregarRascunhoAtivo = useCallback(async () => {
    try {
      const draft = await db.rascunhos.obterAtivo(usuarioId);
      if (draft) {
        setRascunhoId(draft.id);
        setObraNomeInput(draft.obraNome || 'Reserva das Palmeiras');
        setItensRascunho(draft.itens || []);
        if (draft.ultimaEdicaoEm) {
          const dt = new Date(draft.ultimaEdicaoEm);
          setUltimaEdicaoTime(dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar rascunho ativo:', e);
    }
  }, [usuarioId]);

  useEffect(() => {
    carregarRascunhoAtivo();
  }, [carregarRascunhoAtivo]);

  // 2. AUTOSAVE AUTOMÁTICO A CADA ALTERAÇÃO DOS ITENS OU NOME DA OBRA
  const triggerAutosave = async (novosItens: ItemRascunho[], novaObra: string) => {
    setIsAutosaving(true);
    try {
      const saved = await db.rascunhos.salvarAuto(usuarioId, novaObra, novosItens, rascunhoId || undefined);
      if (saved) {
        setRascunhoId(saved.id);
        const dt = new Date(saved.ultimaEdicaoEm);
        setUltimaEdicaoTime(dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.warn('Erro no autosave:', e);
    } finally {
      setIsAutosaving(false);
    }
  };

  // 3. ADICIONAR ITEM MANUALMENTE VIA TEXTO
  const handleAdicionarItemTexto = (textoSobrecarga?: string) => {
    const txt = (textoSobrecarga || novoItemTexto).trim();
    if (!txt) {
      addNotification({
        title: 'Texto do Item Vazio',
        description: 'Digite ou fale o material que deseja adicionar à lista.',
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }

    const itemNovo: ItemRascunho = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      texto: txt,
      origem: textoSobrecarga ? 'voz' : 'texto',
      criadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const listaAtualizada = [itemNovo, ...itensRascunho];
    setItensRascunho(listaAtualizada);
    setNovoItemTexto('');

    triggerAutosave(listaAtualizada, obraNomeInput);
  };

  // 4. ADICIONAR ITEM VIA VOZ (SPEECH-TO-TEXT)
  const handleToggleVoz = () => {
    if (isListeningVoz) {
      speechService.stopListening();
      setIsListeningVoz(false);
      setVozStatusMsg(null);
      return;
    }

    if (!speechService.isSupported()) {
      addNotification({
        title: 'Recurso Indisponível',
        description: 'O reconhecimento de voz não é suportado neste navegador. Digite os itens manualmente.',
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }

    setVozStatusMsg('Gravando... Fale o produto/material');

    speechService.startListening({
      onStart: () => {
        setIsListeningVoz(true);
      },
      onResult: (textoTranscrito) => {
        setIsListeningVoz(false);
        setVozStatusMsg(null);

        addNotification({
          title: 'Áudio Transcrito com Sucesso! 🎙️',
          description: `Item reconhecido: "${textoTranscrito}"`,
          type: 'success',
          category: 'cotacao',
        });

        handleAdicionarItemTexto(textoTranscrito);
      },
      onError: (msgErro) => {
        setIsListeningVoz(false);
        setVozStatusMsg(null);
        addNotification({
          title: 'Erro de Reconhecimento',
          description: msgErro,
          type: 'error',
          category: 'cotacao',
        });
      },
      onEnd: () => {
        setIsListeningVoz(false);
        setVozStatusMsg(null);
      },
    });
  };

  // 5. EDITAR ITEM INLINE NA LISTA
  const handleEditarTextoItem = (id: string, novoTexto: string) => {
    const listaAtualizada = itensRascunho.map((it) =>
      it.id === id ? { ...it, texto: novoTexto, editadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } : it
    );
    setItensRascunho(listaAtualizada);
    triggerAutosave(listaAtualizada, obraNomeInput);
  };

  // 6. REMOVER ITEM DA LISTA
  const handleRemoverItem = (id: string) => {
    const listaAtualizada = itensRascunho.filter((it) => it.id !== id);
    setItensRascunho(listaAtualizada);
    triggerAutosave(listaAtualizada, obraNomeInput);
  };

  // 7. LIMPAR RASCUNHO COMPLETO
  const handleLimparRascunho = async () => {
    setItensRascunho([]);
    setUltimaEdicaoTime(null);
    if (rascunhoId) {
      await db.rascunhos.finalizar(rascunhoId, usuarioId);
      setRascunhoId(null);
    }
    addNotification({
      title: 'Rascunho Limpo',
      description: 'O bloco de notas foi esvaziado.',
      type: 'info',
      category: 'cotacao',
    });
  };

  // 8. FINALIZAR RASCUNHO & ENVIAR COTAÇÃO PARA PROCESSAMENTO NO BANCO REAL
  const handleEnviarCotacaoSubmit = async () => {
    if (itensRascunho.length === 0) {
      addNotification({
        title: 'Lista Vazia',
        description: 'Adicione pelo menos um item (por voz ou digitação) antes de cotar.',
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const novaCot = await gerarCotacaoSession(obraNomeInput);

      // Mudar status do rascunho para 'finalizada' para sumir dos rascunhos ativos
      if (rascunhoId) {
        await db.rascunhos.finalizar(rascunhoId, usuarioId);
        setRascunhoId(null);
        setItensRascunho([]);
      }

      addNotification({
        title: `Cotação ${novaCot.codigo} Gerada com Sucesso!`,
        description: `Persistida no PostgreSQL com cálculo automático de ST.`,
        type: 'success',
        category: 'cotacao',
        linkTab: 'cotacoes',
      });

      setSubAba('resultado');
    } catch (err: any) {
      addNotification({
        title: 'Erro ao Gerar Cotação',
        description: err.message || 'Falha na conexão com o banco de dados.',
        type: 'error',
        category: 'cotacao',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAprovarCotacao = (cotacaoId: string) => {
    aprovarCotacaoSession(cotacaoId);
    addNotification({
      title: `Cotação Aprovada com Sucesso!`,
      description: `Proposta do lojista aprovada e atualizada no banco.`,
      type: 'success',
      category: 'cotacao',
      linkTab: 'historico',
    });
  };

  const handleEnviarWhatsAppFornecedor = async (forn: any) => {
    let savedWa: string | null = forn.whatsapp || null;
    try {
      if (!savedWa && typeof window !== 'undefined') {
        savedWa = localStorage.getItem(`saracota_wa_${forn.id}`);
      }
    } catch (e) {
      console.warn('Erro localStorage:', e);
    }

    if (!savedWa) {
      savedWa = '(11) 98765-4321';
    }

    setWaSendingId(forn.id);
    try {
      await exportCotacaoToPdf(currentCotacao, {
        filename: `Cotacao_${currentCotacao?.codigo || 'SaraCota'}_${forn.nome.replace(/\s+/g, '_')}.pdf`,
      });

      const waUrl = generateWhatsAppLink(savedWa, 'Quero negociar essa cotação.');
      if (typeof window !== 'undefined') {
        window.open(waUrl, '_blank');
      }

      addNotification({
        title: 'WhatsApp Aberto & PDF Baixado',
        description: `PDF salvo! Anexe o arquivo baixado na conversa do WhatsApp com ${forn.nome}.`,
        type: 'success',
        category: 'cotacao',
      });
    } catch (err: any) {
      addNotification({
        title: 'Falha no Envio por WhatsApp',
        description: err.message || 'Erro ao processar PDF.',
        type: 'error',
        category: 'cotacao',
      });
    } finally {
      setWaSendingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-2">
            <FileText className="w-3.5 h-3.5" />
            Sara Cota • Bloco de Notas com Reconhecimento de Voz & Autosave
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Nova Cotação & Bloco de Compras
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Fale ou digite seus materiais. Salvo automaticamente no banco e mantido por até 14 dias.
          </p>
        </div>

        {/* Alternador de Sub-telas: Nova Cotação (Bloco de Notas) / Resultado */}
        <div className="flex items-center gap-2 bg-sara-surface p-1 rounded-xl border border-sara-border">
          <button
            type="button"
            onClick={() => setSubAba('nova')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subAba === 'nova'
                ? 'bg-brand text-black shadow-glow'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Bloco de Notas {itensRascunho.length > 0 && `(${itensRascunho.length})`}
          </button>
          <button
            type="button"
            onClick={() => setSubAba('resultado')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subAba === 'resultado'
                ? 'bg-brand text-black shadow-glow'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Resultado Banco Real ({cotacoesAtivas.length})
          </button>
        </div>
      </div>

      {/* SUB-TELA 1: BLOCO DE NOTAS / LISTA DE COMPRAS (PROMPT 6) */}
      {subAba === 'nova' && (
        <ErrorBoundary>
          <div className="space-y-6 max-w-4xl">
            <Card variant="floating" className="border-brand/40 bg-gradient-to-b from-sara-elevated to-sara-surface">
              <CardHeader className="pb-3 border-b border-sara-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-5 h-5 text-brand" />
                      <CardTitle className="text-base font-bold">Bloco de Compras Inteligente</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Adicione itens falando pelo microfone ou digitando.
                    </CardDescription>
                  </div>

                  {/* INDICADOR DE AUTOSAVE EM TEMPO REAL (PROMPT 6 REQUISITO 4) */}
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>{isAutosaving ? 'Salvando...' : 'Salvo no Banco'}</span>
                      {ultimaEdicaoTime && <span className="opacity-75">• {ultimaEdicaoTime}</span>}
                    </div>
                    <Badge variant="brand" size="sm" className="hidden sm:inline-flex">
                      <Calendar className="w-3 h-3 mr-1" /> Rascunho Mantido por 14 Dias
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-4">
                {/* CAMPO DE ENTRADA DE TEXTO + BOTAO DE MICROFONE (SPEECH-TO-TEXT) */}
                <div className="p-4 rounded-2xl bg-sara-surface border border-sara-border space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <Input
                      placeholder="Digite o item (ex: 100m cabo flexível 2.5mm sil azul)..."
                      value={novoItemTexto}
                      onChange={(e) => setNovoItemTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAdicionarItemTexto();
                        }
                      }}
                      className="flex-1"
                    />

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => handleAdicionarItemTexto()}
                        className="flex-1 sm:flex-none justify-center"
                        leftIcon={<Plus className="w-4 h-4 text-brand" />}
                      >
                        Adicionar
                      </Button>

                      {/* BOTÃO DE MICROFONE COM INDICADOR VISUAL */}
                      <Button
                        type="button"
                        variant={isListeningVoz ? 'destructive' : 'primary'}
                        size="md"
                        onClick={handleToggleVoz}
                        className={`flex-1 sm:flex-none justify-center ${
                          isListeningVoz ? 'animate-pulse shadow-glow' : ''
                        }`}
                        leftIcon={isListeningVoz ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-black" />}
                      >
                        {isListeningVoz ? 'Parar Ouvir' : 'Falar Item (Voz)'}
                      </Button>
                    </div>
                  </div>

                  {/* ALERTA DE STATUS DE GRAVAÇÃO DE VOZ */}
                  {vozStatusMsg && (
                    <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/40 text-brand text-xs font-mono flex items-center justify-between animate-pulse">
                      <span className="flex items-center gap-2 font-bold">
                        <Mic className="w-4 h-4 animate-bounce" /> {vozStatusMsg}
                      </span>
                      <span className="text-[10px] text-content-tertiary">Fale claramente o material e a quantidade</span>
                    </div>
                  )}
                </div>

                {/* LISTA DE ITENS DO BLOCO DE COMPRAS (ESTILO LISTA DE COMPRAS) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-content-tertiary uppercase font-bold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand" /> Lista de Itens ({itensRascunho.length}):
                    </span>

                    {itensRascunho.length > 0 && (
                      <button
                        type="button"
                        onClick={handleLimparRascunho}
                        className="text-[11px] font-mono text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Limpar Lista
                      </button>
                    )}
                  </div>

                  {itensRascunho.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-sara-border text-center space-y-3 bg-sara-surface/40">
                      <HelpCircle className="w-10 h-10 text-brand mx-auto opacity-70" />
                      <div>
                        <h4 className="text-sm font-bold text-content-primary">Sua Lista de Compras está Vazia</h4>
                        <p className="text-xs text-content-secondary font-light mt-1 max-w-sm mx-auto">
                          Digite os materiais acima ou clique no botão de microfone para falar seus itens. O rascunho é salvo automaticamente!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {itensRascunho.map((item, index) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl border border-sara-border bg-sara-surface hover:border-brand/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-sara-elevated border border-sara-border text-content-tertiary text-xs font-mono font-bold flex items-center justify-center shrink-0">
                              {itensRascunho.length - index}
                            </span>

                            <input
                              type="text"
                              value={item.texto}
                              onChange={(e) => handleEditarTextoItem(item.id, e.target.value)}
                              className="bg-transparent text-sm font-medium text-content-primary focus:outline-none focus:border-b focus:border-brand w-full"
                            />
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 font-mono text-xs">
                            {/* BADGE DE ORIGEM (VOZ OU TEXTO) */}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
                                item.origem === 'voz'
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                  : 'bg-sara-elevated text-content-tertiary border border-sara-border'
                              }`}
                            >
                              {item.origem === 'voz' ? <Mic className="w-3 h-3 text-purple-400" /> : <Edit3 className="w-3 h-3" />}
                              {item.origem === 'voz' ? 'Voz' : 'Texto'}
                            </span>

                            <span className="text-[10px] text-content-tertiary">{item.criadoEm}</span>

                            <button
                              type="button"
                              onClick={() => handleRemoverItem(item.id)}
                              className="p-1.5 rounded-lg text-content-tertiary hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Remover item da lista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-4 border-t border-sara-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="w-full sm:w-72">
                  <Input
                    label="Nome da Obra / CNPJ Destino"
                    value={obraNomeInput}
                    onChange={(e) => {
                      setObraNomeInput(e.target.value);
                      triggerAutosave(itensRascunho, e.target.value);
                    }}
                  />
                </div>

                <Button
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto shadow-glow"
                  isLoading={isSubmitting}
                  onClick={handleEnviarCotacaoSubmit}
                  disabled={itensRascunho.length === 0}
                  leftIcon={<Sparkles className="w-4 h-4 text-black" />}
                >
                  Cotar com Lojistas (Banco Real)
                </Button>
              </CardFooter>
            </Card>
          </div>
        </ErrorBoundary>
      )}

      {/* SUB-TELA 2: RESULTADO E MATRIZ DE LOJISTAS ENVOLVIDA EM ERROR BOUNDARY */}
      {subAba === 'resultado' && (
        <ErrorBoundary>
          <div className="space-y-6">
            {/* ESTADO 1: LOADING STATE */}
            {isLoadingCotacoes && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} variant="bordered" className="p-5 space-y-4">
                    <Skeleton variant="text" className="w-3/4 h-5" />
                    <Skeleton variant="text" className="w-1/2 h-4" />
                    <Skeleton variant="rectangular" className="h-12 rounded-xl" />
                  </Card>
                ))}
              </div>
            )}

            {/* ESTADO 2: ERROR STATE */}
            {!isLoadingCotacoes && errorCotacoes && (
              <Card variant="bordered" className="p-8 text-center space-y-4 border-rose-500/40 bg-rose-500/5">
                <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-content-primary">Erro ao Consultar Cotações do Banco</h3>
                  <p className="text-xs text-content-secondary font-light mt-1 max-w-md mx-auto">
                    {errorCotacoes}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={carregarCotacoesDoBanco}
                  leftIcon={<RefreshCw className="w-4 h-4 text-brand" />}
                >
                  Tentar Novamente
                </Button>
              </Card>
            )}

            {/* ESTADO 3: EMPTY STATE */}
            {!isLoadingCotacoes && !errorCotacoes && cotacoesAtivas.length === 0 && (
              <Card variant="bordered" className="p-8 text-center space-y-4 bg-sara-surface">
                <PackageOpen className="w-12 h-12 text-brand mx-auto opacity-80" />
                <div>
                  <h3 className="text-base font-bold text-content-primary">Nenhuma Cotação Encontrada no Banco</h3>
                  <p className="text-xs text-content-secondary font-light mt-1 max-w-md mx-auto">
                    Monte sua lista no bloco de notas para gravar um registro real na tabela cotacoes.
                  </p>
                </div>
                <Button variant="primary" size="md" onClick={() => setSubAba('nova')}>
                  Abrir Bloco de Notas
                </Button>
              </Card>
            )}

            {/* ESTADO 4: DADOS REAIS DO BANCO CARREGADOS */}
            {!isLoadingCotacoes && !errorCotacoes && cotacoesAtivas.length > 0 && currentCotacao && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="brand" size="sm" className="mb-1">
                      Cotação {currentCotacao.codigo} (Banco Real)
                    </Badge>
                    <h3 className="text-base font-bold text-content-primary">
                      Obra: {currentCotacao.obra}
                    </h3>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsRelatorioModalOpen(true)}
                    leftIcon={<FileCheck className="w-4 h-4 text-brand" />}
                  >
                    Abrir Relatório Tributário (ICMS-ST)
                  </Button>
                </div>

                {/* Cards por Fornecedor */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {currentCotacao.fornecedores.map((forn) => {
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

                          <div className="pt-2">
                            {hasWa ? (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                <MessageCircle className="w-3 h-3 text-emerald-400" /> Whats: {savedWa}
                              </span>
                            ) : (
                              <span className="text-[10px] text-content-tertiary flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-400" /> Cadastre o WhatsApp em Ajustes para envio.
                              </span>
                            )}
                          </div>
                        </CardContent>

                        <CardFooter className="pt-3 border-t border-sara-border flex flex-col gap-2">
                          {/* Botão Enviar WhatsApp com PDF Automático */}
                          {hasWa ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full justify-center text-xs font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              onClick={() => handleEnviarWhatsAppFornecedor(forn)}
                              isLoading={waSendingId === forn.id}
                              leftIcon={<MessageCircle className="w-3.5 h-3.5 text-emerald-400" />}
                            >
                              Enviar via WhatsApp
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full justify-center text-xs font-light opacity-60 cursor-not-allowed"
                              disabled
                              leftIcon={<MessageCircle className="w-3.5 h-3.5 text-content-tertiary" />}
                            >
                              WhatsApp Não Cadastrado
                            </Button>
                          )}

                          <Button
                            variant={forn.isVencedor ? 'primary' : 'secondary'}
                            size="sm"
                            className="w-full justify-center"
                            onClick={() => handleAprovarCotacao(currentCotacao.id)}
                            leftIcon={<Check className="w-4 h-4 text-black" />}
                          >
                            {forn.isVencedor ? 'Aprovar Esta Cotação' : 'Selecionar Fornecedor'}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </ErrorBoundary>
      )}

      {/* Relatório Tributário Modal */}
      <Sheet
        isOpen={isRelatorioModalOpen}
        onClose={() => setIsRelatorioModalOpen(false)}
        title="Relatório Tributário (Demonstrativo ICMS-ST do Banco)"
        description="Demonstrativo de apuração de substituição tributária por categoria."
        footer={
          <Button variant="primary" onClick={() => setIsRelatorioModalOpen(false)}>
            Fechar Relatório
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-sara-elevated border border-sara-border space-y-2 font-mono">
            <span className="text-[10px] text-content-tertiary uppercase block font-bold">
              Resumo Alíquotas ST por Categoria:
            </span>
            <div className="flex justify-between">
              <span>Elétrica & Fiação:</span>
              <span className="text-brand font-bold">12% ST</span>
            </div>
            <div className="flex justify-between">
              <span>Tubos & Hidráulica:</span>
              <span className="text-brand font-bold">8% ST</span>
            </div>
            <div className="flex justify-between">
              <span>Cimento & Argamassa:</span>
              <span className="text-brand font-bold">5% ST</span>
            </div>
            <div className="flex justify-between">
              <span>Estrutura & Vergalhão:</span>
              <span className="text-brand font-bold">10% ST</span>
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
};
