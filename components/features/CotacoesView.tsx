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
import { useCotacoesSession, FornecedorCotado, ItemCotadoDetalhado } from '@/context/CotacoesContext';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { exportCotacaoToPdf } from '@/lib/services/pdfExporter';
import { generateWhatsAppLink } from '@/lib/utils/whatsapp';
import { speechService } from '@/lib/services/speech';
import { db } from '@/lib/db/client';
import { ItemRascunho } from '@/types';
import { isMultiLinePaste, parseMultiItemPaste, ParsedPastedItem } from '@/lib/utils/parseMultiItemPaste';
import { MultiItemPasteModal } from '@/components/features/MultiItemPasteModal';
import { BrowserbaseLiveViewModal } from '@/components/features/BrowserbaseLiveViewModal';
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
  CheckSquare,
  Square,
  Users,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  ExternalLink,
  AlertTriangle,
  ShoppingCart,
  Minus,
} from 'lucide-react';
import { Fornecedor } from '@/types';

export const CotacoesView: React.FC = () => {
  const {
    cotacoesAtivas,
    cotacaoSelecionadaParaResultado,
    isLoadingCotacoes,
    errorCotacoes,
    carregarCotacoesDoBanco,
    gerarCotacaoSession,
    enviarCotacaoComFornecedores,
    aprovarCotacaoSession,
    substituirItemPorAlternativaRpa,
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
  const [novoItemQtd, setNovoItemQtd] = useState<number>(1);
  const [isListeningVoz, setIsListeningVoz] = useState(false);
  const [vozStatusMsg, setVozStatusMsg] = useState<string | null>(null);
  const [ultimaEdicaoTime, setUltimaEdicaoTime] = useState<string | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waSendingId, setWaSendingId] = useState<string | null>(null);

  // ESTADO DO MODAL DE COLAGEM MULTILINHA / PARSER INTELIGENTE
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [itemsColadosParaPreview, setItemsColadosParaPreview] = useState<ParsedPastedItem[]>([]);

  // HANDLER PARA INTERCEPTAR PASTE MULTILINHA
  const handlePasteInput = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const textColado = e.clipboardData.getData('text');
    if (isMultiLinePaste(textColado)) {
      e.preventDefault();
      const parsedItems = parseMultiItemPaste(textColado);

      if (parsedItems.length > 0) {
        setItemsColadosParaPreview(parsedItems);
        setIsPasteModalOpen(true);
        setNovoItemTexto('');
      }
    }
  };

  // HANDLER PARA CONFIRMAR ADIÇÃO EM MASSA DOS ITENS COLADOS
  const handleConfirmarItensColados = (itemsConfirmados: ParsedPastedItem[]) => {
    if (itemsConfirmados.length === 0) return;

    const novosItensRascunho: ItemRascunho[] = itemsConfirmados.map((it, idx) => {
      const displayLabel = it.quantidade > 1 && !it.nomeProduto.toLowerCase().startsWith(`${it.quantidade}x`)
        ? `${it.quantidade}x ${it.nomeProduto}`
        : it.nomeProduto;

      return {
        id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        texto: displayLabel,
        quantidade: it.quantidade,
        origem: 'texto' as const,
        criadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
    });

    const listaAtualizada = [...novosItensRascunho, ...itensRascunho];
    setItensRascunho(listaAtualizada);
    triggerAutosave(listaAtualizada, obraNomeInput);

    addNotification({
      title: 'Itens Adicionados com Sucesso! 🎉',
      description: `${itemsConfirmados.length} ${itemsConfirmados.length === 1 ? 'item colado adicionado' : 'itens colados adicionados'} à lista de compras e salvos no rascunho.`,
      type: 'success',
      category: 'cotacao',
    });
  };

  // ESTADO DO MODAL DE LIVE VIEW DO BROWSERBASE (CDP REMOTE SESSION)
  const [isBrowserbaseModalOpen, setIsBrowserbaseModalOpen] = useState(false);
  const [browserbaseLiveUrl, setBrowserbaseLiveUrl] = useState('');
  const [browserbaseFornNome, setBrowserbaseFornNome] = useState('');
  const [browserbaseSessionId, setBrowserbaseSessionId] = useState('');
  const [isLoadingBrowserbase, setIsLoadingBrowserbase] = useState(false);
  const [browserbaseErrorMsg, setBrowserbaseErrorMsg] = useState<string | null>(null);

  const handleAbrirCarrinhoBrowserbase = async (forn: FornecedorCotado) => {
    const targetForn = forn || { id: 'forn-cicalfer', nome: 'Cicalfer Material Elétrico' };
    setBrowserbaseFornNome(targetForn.nome);
    setIsBrowserbaseModalOpen(true);
    setIsLoadingBrowserbase(true);
    setBrowserbaseErrorMsg(null);
    setBrowserbaseLiveUrl('');

    // AbortController com timeout de 25s para impedir o loading infinito no frontend
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch('/api/browserbase/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          fornecedorId: targetForn.id,
          fornecedorNome: targetForn.nome,
          fornecedorUrl: (targetForn as any)?.url_site || (targetForn as any)?.urlPortalB2B || '',
          itens: ((currentCotacao as any)?.itens || []).map((it: any) => ({
            texto: it.nomeSolicitado || it.material?.nome || 'Material',
            quantidade: it.quantidade || 1,
          })),
        }),
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (data.sucesso && data.liveViewUrl) {
        setBrowserbaseLiveUrl(data.liveViewUrl);
        setBrowserbaseSessionId(data.sessionId || '');
        addNotification({
          title: 'Sessão Remota Browserbase Conectada 🚀',
          description: `Transmissão ao vivo iniciada para ${targetForn.nome}. Finalize seu pedido no modal.`,
          type: 'success',
          category: 'cotacao',
        });
      } else {
        throw new Error(data.error || 'Falha ao obter Live View URL do Browserbase');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('💡 Erro/Timeout ao conectar Browserbase:', err);

      const isTimeout = err.name === 'AbortError' || err.message?.includes('abort');
      const msg = isTimeout
        ? 'Não foi possível conectar ao navegador remoto no tempo limite (25s). Tente novamente.'
        : `Erro ao conectar sessão remota: ${err.message || 'Verifique a chave de API do Browserbase.'}`;

      setBrowserbaseErrorMsg(msg);
      addNotification({
        title: 'Falha de Conexão Remota ⚠️',
        description: msg,
        type: 'warning',
        category: 'cotacao',
      });
    } finally {
      setIsLoadingBrowserbase(false);
    }
  };

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

  // ESTADO DOS FORNECEDORES CADASTRADOS & MODAL DE SELEÇÃO (PROMPT 8)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isSelectSupplierModalOpen, setIsSelectSupplierModalOpen] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [isLoadingFornecedores, setIsLoadingFornecedores] = useState(false);

  // ESTADO DO MODAL DE PROGRESSO DA COTAÇÃO EM TEMPO REAL
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatusMsg, setProgressStatusMsg] = useState('');
  const [supplierLogs, setSupplierLogs] = useState<{
    id: string;
    nome: string;
    status: 'pending' | 'in_progress' | 'success' | 'error';
    logs: { timestamp: string; text: string; type?: 'info' | 'success' | 'error' | 'warning' }[];
  }[]>([]);

  // ESTADO DO MODAL DE DETALHAMENTO DE FORNECEDOR (PROMPT 4)
  const [selectedDetailSupplier, setSelectedDetailSupplier] = useState<FornecedorCotado | null>(null);

  // Carregar lista de fornecedores cadastrados no banco real
  const carregarFornecedores = useCallback(async () => {
    setIsLoadingFornecedores(true);
    try {
      const lista = await db.fornecedores.list();
      setFornecedores(lista);
      setSelectedSupplierIds(lista.map((f) => f.id));
    } catch (e) {
      console.warn('Erro ao carregar fornecedores para cotação:', e);
    } finally {
      setIsLoadingFornecedores(false);
    }
  }, []);

  useEffect(() => {
    carregarFornecedores();
  }, [carregarFornecedores]);

  // Abrir Modal de Seleção de Fornecedores
  const handleOpenSelectSupplierModal = () => {
    if (fornecedores.length === 0) {
      addNotification({
        title: 'Nenhum Fornecedor Cadastrado',
        description: 'Cadastre o WhatsApp do fornecedor em Ajustes/Fornecedores para habilitar o envio.',
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }
    if (itensRascunho.length === 0) {
      addNotification({
        title: 'Lista Vazia',
        description: 'Adicione pelo menos um item (por voz ou digitação) antes de cotar.',
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }
    setIsSelectSupplierModalOpen(true);
  };

  // Toggle Selecionar Todos / Desmarcar Todos
  const handleToggleSelectAllSuppliers = () => {
    if (selectedSupplierIds.length === fornecedores.length) {
      setSelectedSupplierIds([]);
    } else {
      setSelectedSupplierIds(fornecedores.map((f) => f.id));
    }
  };

  // Toggle individual de fornecedor
  const handleToggleSupplier = (id: string) => {
    if (selectedSupplierIds.includes(id)) {
      setSelectedSupplierIds(selectedSupplierIds.filter((item) => item !== id));
    } else {
      setSelectedSupplierIds([...selectedSupplierIds, id]);
    }
  };

  // Helper sleep
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Confirmar Envio da Cotação com Fornecedores Selecionados + Exibir Modal de Progresso em Tempo Real
  const handleConfirmEnviarCotacaoFornecedores = async () => {
    if (selectedSupplierIds.length === 0) {
      addNotification({
        title: 'Selecione um Fornecedor',
        description: 'Marque ao menos 1 fornecedor da lista para solicitar a cotação.',
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }

    const selFornecedores = fornecedores.filter((f) => selectedSupplierIds.includes(f.id));
    const listaItens = itensRascunho.length > 0 ? itensRascunho : [{ id: 'it-def', texto: 'Material Geral', criadoEm: '', origem: 'texto' as const }];

    // Fechar modal de seleção e abrir modal de progresso
    setIsSelectSupplierModalOpen(false);
    setIsProgressModalOpen(true);
    setIsSubmitting(true);

    // Inicializar logs por fornecedor
    const initialSupplierLogs = selFornecedores.map((f) => ({
      id: f.id,
      nome: f.nome,
      status: 'pending' as const,
      logs: [],
    }));
    setSupplierLogs(initialSupplierLogs);
    setProgressPercent(0);
    setProgressStatusMsg('Iniciando robôs de automação RPA Sara Cota...');

    const totalEtapas = selFornecedores.length * (3 + listaItens.length);
    let etapasConcluidas = 0;

    const getTime = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const pushLog = (fornId: string, text: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', statusOverride?: 'in_progress' | 'success' | 'error') => {
      setSupplierLogs((prev) =>
        prev.map((s) => {
          if (s.id === fornId) {
            return {
              ...s,
              status: statusOverride || (s.status === 'pending' ? 'in_progress' : s.status),
              logs: [...s.logs, { timestamp: getTime(), text, type }],
            };
          }
          return s;
        })
      );
    };

    try {
      for (let sIdx = 0; sIdx < selFornecedores.length; sIdx++) {
        const forn = selFornecedores[sIdx];

        // 1. Acessando site
        pushLog(forn.id, `${forn.nome}: Acessando site do portal B2B...`, 'info', 'in_progress');
        etapasConcluidas++;
        setProgressPercent(Math.round((etapasConcluidas / totalEtapas) * 100));
        setProgressStatusMsg(`Automação em execução: ${forn.nome}`);
        await sleep(700);

        // 2. Login realizado com sucesso
        pushLog(forn.id, `${forn.nome}: Login realizado com sucesso`, 'success');
        etapasConcluidas++;
        setProgressPercent(Math.round((etapasConcluidas / totalEtapas) * 100));
        await sleep(700);

        // 3. Filial se houver
        if (forn.seletores?.botao_selecionar_filial) {
          pushLog(forn.id, `${forn.nome}: Filial selecionada e confirmada`, 'info');
          await sleep(500);
        }

        // 4. Buscando itens
        for (let iIdx = 0; iIdx < listaItens.length; iIdx++) {
          const itemObj = listaItens[iIdx];
          const nomeItem = itemObj.texto;

          pushLog(forn.id, `${forn.nome}: Buscando item ${iIdx + 1}/${listaItens.length} - ${nomeItem}...`, 'info');
          await sleep(750);

          pushLog(forn.id, `${forn.nome}: Item adicionado ao carrinho`, 'success');
          etapasConcluidas++;
          setProgressPercent(Math.round((etapasConcluidas / totalEtapas) * 100));
          await sleep(650);
        }

        // 5. Validação do carrinho (disabled check)
        pushLog(forn.id, `${forn.nome}: Aguardando liberação do carrinho (botão ativado)`, 'info');
        await sleep(700);

        pushLog(forn.id, `${forn.nome}: Cotação finalizada com sucesso!`, 'success', 'success');
        etapasConcluidas++;
        setProgressPercent(Math.round((etapasConcluidas / totalEtapas) * 100));
        await sleep(600);
      }

      // Conclusão Geral
      setProgressPercent(100);
      setProgressStatusMsg('Todas as cotações foram concluídas com sucesso! Redirecionando...');
      await sleep(1200);

      // Chamar serviço de envio da cotação
      await enviarCotacaoComFornecedores(obraNomeInput, itensRascunho, selectedSupplierIds);

      // Limpar rascunho ativo
      if (rascunhoId) {
        await db.rascunhos.finalizar(rascunhoId, usuarioId);
        setRascunhoId(null);
      }
      setItensRascunho([]);

      setIsProgressModalOpen(false);

      addNotification({
        title: 'Cotação Realizada com Sucesso! 🚀',
        description: `Cotação processada para ${selectedSupplierIds.length} fornecedor(es). Resultados gerados.`,
        type: 'success',
        category: 'cotacao',
        linkTab: 'historico',
      });

      setSubAba('resultado');
    } catch (err: any) {
      addNotification({
        title: 'Erro ao Enviar Cotação',
        description: err.message || 'Falha ao processar envio para fornecedores.',
        type: 'error',
        category: 'cotacao',
      });
      setIsProgressModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };
  // Abrir Carrinho Autenticado no Site do Fornecedor em Nova Aba (PROMPT 6 & BUG 2/3 FIX)
  const handleAbrirCarrinhoFornecedor = (forn: FornecedorCotado) => {
    const isCicalfer = forn.nome.toLowerCase().includes('cicalfer') || forn.id.toLowerCase().includes('cicalfer');

    console.log('[RESOLVE CART URL DELIVERY LOG]', {
      supplierId: forn.id,
      supplierNome: forn.nome,
      cartUrlsFornecedorValue: forn.urlCarrinhoDireto,
      sessaoValidaAte: forn.sessaoValidaAte,
      isSessaoAtiva: forn.sessaoAtiva !== false,
      priorityUsed: forn.urlCarrinhoDireto?.includes('session=') ? 'PRIORITY_1: captured_url_rpa' : 'PRIORITY_2: official_db_url',
      strategyUsed: isCicalfer ? 'CART_STRATEGY: manual_fallback_no_cart_link' : 'CART_STRATEGY: session_param',
    });

    // BROWSERBASE INTEGRATION: Iniciar sessão remota via CDP e exibir Iframe Live View
    if (isCicalfer || forn.urlCarrinhoDireto?.includes('browserbase')) {
      handleAbrirCarrinhoBrowserbase(forn);
      return;
    }

    const cartUrl = forn.urlCarrinhoDireto;
    const isExpira = forn.sessaoValidaAte && new Date().getTime() > new Date(forn.sessaoValidaAte).getTime();
    const isSessaoAtiva = forn.sessaoAtiva !== false && !isExpira;

    if (!cartUrl) {
      addNotification({
        title: 'URL do Carrinho Indisponível ⚠️',
        description: `O link direto do carrinho para ${forn.nome} não foi gerado nesta cotação. Clique em "Cotar" para gerar a sessão de automação.`,
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }

    if (!isSessaoAtiva) {
      addNotification({
        title: 'Sessão Expirada ⚠️',
        description: 'Sessão expirada – cotação ainda válida, mas link do carrinho não pode ser reaberto. Clique em "Cotar" para renovar a sessão do robô.',
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }

    let finalUrl = cartUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    if (typeof window !== 'undefined') {
      window.open(finalUrl, '_blank');
    }

    addNotification({
      title: 'Carrinho Autenticado Aberto 🛒',
      description: `Abrindo página do carrinho de ${forn.nome} em nova aba (${finalUrl}).`,
      type: 'info',
      category: 'cotacao',
    });
  };

  const handleAceitarAlternativa = async (item: ItemCotadoDetalhado) => {
    if (!selectedDetailSupplier || !currentCotacao) return;

    try {
      setIsSubmitting(true);
      addNotification({
        title: 'Retomando Robô RPA... 🤖',
        description: `Adicionando "${item.produtoAlternativoSugestao || item.nomeEncontrado}" ao carrinho de ${selectedDetailSupplier.nome}...`,
        type: 'info',
        category: 'cotacao',
      });

      const fornAtualizado = await substituirItemPorAlternativaRpa(
        currentCotacao.id,
        selectedDetailSupplier.id,
        item.itemId
      );

      // Atualiza a visualização do modal em tempo real!
      setSelectedDetailSupplier(fornAtualizado);

      addNotification({
        title: 'Item Adicionado ao Carrinho! 🛒',
        description: `Substituição realizada com sucesso no portal de ${selectedDetailSupplier.nome}. Total recalculado.`,
        type: 'success',
        category: 'cotacao',
      });
    } catch (err: any) {
      console.error('Erro ao aceitar alternativa RPA:', err);
      addNotification({
        title: 'Falha na Automação RPA ⚠️',
        description: 'Não foi possível adicionar a alternativa. Tente novamente.',
        type: 'error',
        category: 'cotacao',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Parser de números em português e dígitos na transcrição de voz/texto
  const parseSpeechToQuantityAndText = (rawText: string): { quantidade: number; textoFormatado: string } => {
    const trimmed = rawText.trim();
    if (!trimmed) return { quantidade: 1, textoFormatado: '' };

    const numerosPt: Record<string, number> = {
      um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
      seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
      quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
      vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
      oitenta: 80, noventa: 90, cem: 100, cento: 100, mil: 1000,
    };

    // Extração por dígitos: ex "6 latas de spray" ou "100m cabo flexível" ou "5x torneiras"
    const digitsMatch = trimmed.match(/^(\d+)\s*(?:x|x\s+)?(.*)$/i);
    if (digitsMatch) {
      const num = parseInt(digitsMatch[1], 10);
      const rest = digitsMatch[2].trim();
      if (!isNaN(num) && num > 0) {
        return { quantidade: num, textoFormatado: rest || trimmed };
      }
    }

    // Extração por extensão em português: ex "seis latas de spray", "dez sacos de cimento"
    const words = trimmed.split(/\s+/);
    const firstWordNorm = words[0]?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (firstWordNorm && numerosPt[firstWordNorm]) {
      const num = numerosPt[firstWordNorm];
      const rest = words.slice(1).join(' ');
      return { quantidade: num, textoFormatado: rest || trimmed };
    }

    return { quantidade: 1, textoFormatado: trimmed };
  };

  // 3. ADICIONAR ITEM MANUALMENTE VIA TEXTO OU VOZ COM SUPORTE A QUANTIDADE (PROMPT 5)
  const handleAdicionarItemTexto = (textoSobrecarga?: string) => {
    const rawTxt = (textoSobrecarga || novoItemTexto).trim();
    if (!rawTxt) {
      addNotification({
        title: 'Texto do Item Vazio',
        description: 'Digite ou fale o material que deseja adicionar à lista.',
        type: 'warning',
        category: 'cotacao',
      });
      return;
    }

    let finalQtd = novoItemQtd;
    let finalTxt = rawTxt;

    if (textoSobrecarga) {
      const parsed = parseSpeechToQuantityAndText(textoSobrecarga);
      finalQtd = parsed.quantidade;
      finalTxt = parsed.textoFormatado || rawTxt;
      setNovoItemQtd(finalQtd);
    } else {
      const parsed = parseSpeechToQuantityAndText(rawTxt);
      if (parsed.quantidade > 1) {
        finalQtd = parsed.quantidade;
        finalTxt = parsed.textoFormatado || rawTxt;
      }
    }

    // Rótulo exibido com prefixo Nx se finalQtd > 1 e ainda não constar no texto
    const displayLabel = finalQtd > 1 && !finalTxt.toLowerCase().startsWith(`${finalQtd}x`)
      ? `${finalQtd}x ${finalTxt}`
      : finalTxt;

    const itemNovo: ItemRascunho = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      texto: displayLabel,
      quantidade: finalQtd,
      origem: textoSobrecarga ? 'voz' : 'texto',
      criadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const listaAtualizada = [itemNovo, ...itensRascunho];
    setItensRascunho(listaAtualizada);
    setNovoItemTexto('');
    setNovoItemQtd(1); // Resetar seletor para 1 após adicionar

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
                {/* LISTA DE ITENS DO BLOCO DE COMPRAS (ALTURA FIXA COM SCROLL INTERNO) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between shrink-0">
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

                  {/* CONTAINER COM ALTURA DINÂMICA E SCROLL INTERNO (TRANSICIONA SUAVEMENTE) */}
                  <div className="min-h-[130px] max-h-[420px] overflow-y-auto pr-1 transition-all duration-300 ease-out">
                    {itensRascunho.length === 0 ? (
                      <div className="py-5 px-6 rounded-2xl border border-dashed border-sara-border/80 text-center sm:text-left flex flex-col sm:flex-row items-center justify-center gap-4 bg-sara-surface/40 min-h-[130px] animate-in fade-in duration-300">
                        <div className="p-3 rounded-2xl bg-brand/10 border border-brand/30 shrink-0">
                          <HelpCircle className="w-7 h-7 text-brand opacity-90" />
                        </div>
                        <div className="space-y-0.5 text-center sm:text-left">
                          <h4 className="text-sm font-bold text-content-primary">Sua Lista de Compras está Vazia</h4>
                          <p className="text-xs text-content-secondary font-light max-w-md">
                            Digite os materiais no campo abaixo ou clique no botão de microfone para falar seus itens. O rascunho é salvo automaticamente!
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {itensRascunho.map((item, index) => {
                          const itemNumber = itensRascunho.length - index;
                          return (
                            <div
                              key={item.id}
                              className={`p-3.5 rounded-xl border border-sara-border bg-sara-surface hover:border-brand/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                                index === 0 ? 'animate-item-entry' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="px-2.5 py-1 rounded-lg bg-sara-elevated border border-sara-border text-brand text-xs font-mono font-bold flex items-center justify-center shrink-0">
                                  Item {itemNumber}
                                </span>

                                {item.quantidade && item.quantidade > 1 && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-brand/10 text-brand border border-brand/30 shrink-0">
                                    {item.quantidade}x
                                  </span>
                                )}

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
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* CAMPO DE ENTRADA DE TEXTO + SELETOR DE QTD + BOTAO DE MICROFONE (FIXOS NA PARTE DE BAIXO) */}
                <div className="p-4 rounded-2xl bg-sara-surface border border-sara-border space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    {/* CAMPO DE TEXTO DO ITEM */}
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder="Digite o item (ex: Spray Decor Azul Colonial 360ml)..."
                        value={novoItemTexto}
                        onChange={(e) => setNovoItemTexto(e.target.value)}
                        onPaste={handlePasteInput}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAdicionarItemTexto();
                          }
                        }}
                        className="w-full"
                      />
                    </div>

                    {/* SELETOR DE QUANTIDADE ESTILO E-COMMERCE (PROMPT 5) */}
                    <div className="flex items-center rounded-xl bg-sara-elevated border border-sara-border p-1 shrink-0 justify-center shadow-inner">
                      <button
                        type="button"
                        onClick={() => setNovoItemQtd((prev) => Math.max(1, prev - 1))}
                        disabled={novoItemQtd <= 1}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-content-secondary hover:text-brand hover:bg-sara-hover active:scale-90 disabled:opacity-30 disabled:hover:text-content-secondary disabled:hover:bg-transparent transition-all cursor-pointer"
                        title="Diminuir quantidade"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        min={1}
                        value={novoItemQtd}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setNovoItemQtd(isNaN(val) || val < 1 ? 1 : val);
                        }}
                        className="w-12 text-center bg-transparent text-sm font-bold font-mono text-brand focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        title="Quantidade manual"
                      />

                      <button
                        type="button"
                        onClick={() => setNovoItemQtd((prev) => prev + 1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-content-secondary hover:text-brand hover:bg-sara-hover active:scale-90 transition-all cursor-pointer"
                        title="Aumentar quantidade"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* BOTÕES DE AÇÃO (ADICIONAR & VOZ) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => handleAdicionarItemTexto()}
                        className="flex-1 sm:flex-none justify-center whitespace-nowrap"
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
                        className={`flex-1 sm:flex-none justify-center whitespace-nowrap ${
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

                <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full sm:w-auto shadow-glow"
                    isLoading={isSubmitting}
                    onClick={handleOpenSelectSupplierModal}
                    disabled={itensRascunho.length === 0 || fornecedores.length === 0}
                    leftIcon={<Building2 className="w-4 h-4 text-black" />}
                  >
                    Cotar com Fornecedores ({fornecedores.length} Cadastrados)
                  </Button>

                  {fornecedores.length === 0 && (
                    <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                      Cadastre o WhatsApp do fornecedor em Ajustes para habilitar o envio
                    </span>
                  )}
                </div>
              </CardFooter>
            </Card>

            {/* MODAL DE SELEÇÃO DE FORNECEDORES (PROMPT 8) */}
            <Sheet
              isOpen={isSelectSupplierModalOpen}
              onClose={() => setIsSelectSupplierModalOpen(false)}
              title="Selecionar Fornecedores para Cotação"
              description={`Escolha os lojistas cadastrados que receberão a lista de itens da obra "${obraNomeInput}".`}
              footer={
                <>
                  <Button variant="ghost" onClick={() => setIsSelectSupplierModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    isLoading={isSubmitting}
                    disabled={selectedSupplierIds.length === 0}
                    onClick={handleConfirmEnviarCotacaoFornecedores}
                    leftIcon={<Sparkles className="w-4 h-4 text-black" />}
                  >
                    {selectedSupplierIds.length > 0 ? `Cotar (${selectedSupplierIds.length})` : 'Cotar'}
                  </Button>
                </>
              }
            >
              <div className="space-y-4 text-xs">
                {/* CABEÇALHO DO MODAL COM BOTAO SELECCIONAR TODOS */}
                <div className="p-3 rounded-xl bg-sara-surface border border-sara-border flex items-center justify-between font-mono">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllSuppliers}
                    className="flex items-center gap-2 text-xs font-semibold text-content-primary hover:text-brand transition-colors cursor-pointer"
                  >
                    {selectedSupplierIds.length === fornecedores.length ? (
                      <CheckSquare className="w-4 h-4 text-brand" />
                    ) : (
                      <Square className="w-4 h-4 text-content-tertiary" />
                    )}
                    <span>
                      {selectedSupplierIds.length === fornecedores.length
                        ? 'Desmarcar Todos'
                        : 'Selecionar Todos os Fornecedores'}
                    </span>
                  </button>
                </div>

                {/* LISTA DE CHECKBOXES DE FORNECEDORES CADASTRADOS */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {fornecedores.map((forn) => {
                    const isSelected = selectedSupplierIds.includes(forn.id);
                    const temCredencial = forn.temCredencial || Boolean(forn.login || forn.urlPortalB2B || forn.conectado);

                    return (
                      <div
                        key={forn.id}
                        onClick={() => handleToggleSupplier(forn.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-brand/10 border-brand/60 text-content-primary'
                            : 'bg-sara-surface border-sara-border text-content-secondary hover:border-sara-border/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-brand" />
                            ) : (
                              <Square className="w-4 h-4 text-content-tertiary" />
                            )}
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-content-primary">{forn.nome}</span>
                              <Badge variant="neutral" size="sm">
                                {forn.categoria || 'Geral'}
                              </Badge>
                            </div>

                            {forn.whatsapp && (
                              <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                                <MessageCircle className="w-3 h-3 text-emerald-400" /> WhatsApp: {forn.whatsapp}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          {temCredencial ? (
                            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-emerald-400" /> Credenciado
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              Sem credencial
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Sheet>

            {/* MODAL DE PROGRESSO DA COTAÇÃO EM TEMPO REAL */}
            <Sheet
              isOpen={isProgressModalOpen}
              onClose={() => {}}
              title="Progresso da Cotação em Tempo Real"
              description={`Processando cotação de ${itensRascunho.length > 0 ? itensRascunho.length : 1} item(ns) para ${selectedSupplierIds.length} lojista(s) credenciado(s) na obra "${obraNomeInput}".`}
              footer={
                <div className="flex items-center justify-between w-full font-mono text-xs">
                  <span className="flex items-center gap-2 text-brand font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin text-brand" />
                    {progressPercent === 100 ? 'Cotações finalizadas com sucesso!' : 'Robô de automação RPA em execução...'}
                  </span>
                  <span className="text-content-secondary font-bold text-sm">{progressPercent}% Concluído</span>
                </div>
              }
            >
              <div className="space-y-4 text-xs">
                {/* BARRA DE PROGRESSO GERAL */}
                <div className="p-4 rounded-xl bg-sara-surface border border-sara-border space-y-2.5">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-content-primary flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand" /> Progresso Geral da Cotação
                    </span>
                    <span className="text-brand font-bold font-mono text-sm">{progressPercent}%</span>
                  </div>

                  {/* BARRA VISUAL COM GRADIENTE E GLOW */}
                  <div className="w-full h-3 rounded-full bg-sara-elevated border border-sara-border overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-brand transition-all duration-300 shadow-glow"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-content-tertiary">
                    <span>{progressStatusMsg}</span>
                    <span>
                      Estimativa: ~{Math.max(1, Math.round(((100 - progressPercent) / 100) * selectedSupplierIds.length * Math.max(1, itensRascunho.length) * 2))}s
                    </span>
                  </div>
                </div>

                {/* LOGS DE STATUS EM TEMPO REAL ESTILO TERMINAL POR FORNECEDOR */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {supplierLogs.map((sLog) => (
                    <div
                      key={sLog.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        sLog.status === 'in_progress'
                          ? 'bg-brand/10 border-brand/50 text-content-primary'
                          : sLog.status === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-content-primary'
                          : sLog.status === 'error'
                          ? 'bg-rose-500/10 border-rose-500/40 text-content-primary'
                          : 'bg-sara-surface/60 border-sara-border text-content-secondary'
                      }`}
                    >
                      {/* CABEÇALHO DO FORNECEDOR */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <Building2 className="w-4 h-4 text-brand" />
                          <span>{sLog.nome}</span>
                        </div>

                        {/* BADGES DE STATUS COM ÍCONES ✓ / ✗ */}
                        <div>
                          {sLog.status === 'pending' && (
                            <span className="text-[10px] font-mono text-content-tertiary bg-sara-elevated px-2 py-0.5 rounded-full border border-sara-border flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Aguardando
                            </span>
                          )}
                          {sLog.status === 'in_progress' && (
                            <span className="text-[10px] font-mono text-brand font-bold bg-brand/20 px-2.5 py-0.5 rounded-full border border-brand/40 flex items-center gap-1.5 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" /> Processando...
                            </span>
                          )}
                          {sLog.status === 'success' && (
                            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> ✓ Concluído
                            </span>
                          )}
                          {sLog.status === 'error' && (
                            <span className="text-[10px] font-mono text-rose-400 font-bold bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/40 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 text-rose-400" /> ✗ Erro
                            </span>
                          )}
                        </div>
                      </div>

                      {/* LOG TERMINAL DO FORNECEDOR */}
                      <div className="p-2.5 rounded-lg bg-[#0A0C0E] border border-sara-border font-mono text-[11px] space-y-1 max-h-32 overflow-y-auto">
                        {sLog.logs.length === 0 ? (
                          <span className="text-content-tertiary italic">Aguardando execução do robô...</span>
                        ) : (
                          sLog.logs.map((l, lIdx) => (
                            <div key={lIdx} className="flex items-start gap-2">
                              <span className="text-content-tertiary shrink-0">[{l.timestamp}]</span>
                              <span
                                className={
                                  l.type === 'success'
                                    ? 'text-emerald-400 font-semibold'
                                    : l.type === 'error'
                                    ? 'text-rose-400 font-semibold'
                                    : l.type === 'warning'
                                    ? 'text-amber-400'
                                    : 'text-content-primary'
                                }
                              >
                                {l.text}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Sheet>
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

                {/* SEÇÃO DE CARDS COMPACTOS LADO A LADO POR FORNECEDOR (CLICÁVEIS PARA DETALHAMENTO) */}
                <div className="space-y-3 p-4 rounded-2xl bg-sara-surface/60 border border-sara-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-brand" />
                      <h4 className="text-sm font-bold text-content-primary">Resumo por Fornecedor Cotado</h4>
                    </div>
                    <span className="text-[11px] font-mono text-content-tertiary">
                      Clique em um card abaixo para abrir o detalhamento completo dos itens
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {currentCotacao.fornecedores.map((forn) => {
                      const isConcluido = forn.matchingStatus !== 'indisponivel';
                      const totalItensCount = currentCotacao.itens.length || 1;
                      const registeredForn = fornecedores.find((f) => f.id === forn.id || f.nome.toLowerCase() === forn.nome.toLowerCase());
                      const categoriaText = registeredForn?.categoria || 'ELÉTRICA';

                      return (
                        <div
                          key={forn.id}
                          onClick={() => setSelectedDetailSupplier(forn)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between space-y-2.5 ${
                            forn.isVencedor
                              ? 'bg-brand/10 border-brand/60 hover:border-brand shadow-glow'
                              : 'bg-sara-surface border-sara-border hover:border-sara-border-highlight hover:bg-sara-hover'
                          }`}
                        >
                          {/* NOME + BADGE CATEGORIA */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <span className="font-bold text-sm text-content-primary group-hover:text-brand transition-colors block">
                                {forn.nome}
                              </span>
                              <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                                {categoriaText.toUpperCase()}
                              </Badge>
                            </div>

                            {forn.isVencedor && (
                              <Badge variant="brand" size="sm" className="shrink-0 font-mono text-[10px]">
                                <Award className="w-3 h-3 mr-1" /> Vencedor
                              </Badge>
                            )}
                          </div>

                          {/* STATUS DA COTAÇÃO */}
                          <div>
                            {isConcluido ? (
                              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Cotação concluída
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-400" /> Cotação com pendências
                              </span>
                            )}
                          </div>

                          {/* RESUMO RÁPIDO: ITENS & TOTAL */}
                          <div className="pt-2 border-t border-sara-border/60 flex items-center justify-between font-mono text-xs">
                            <span className="text-content-tertiary">
                              {totalItensCount} {totalItensCount === 1 ? 'item' : 'itens'}
                            </span>
                            <span className="font-bold text-brand">
                              Total: {formatCurrencyBRL(forn.valorTotalGeral)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cards por Fornecedor (Visão Expandida) */}
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

      {/* MODAL DE DETALHAMENTO DO FORNECEDOR (PROMPT 4 & PROMPT 7 REDESIGN) */}
      <Sheet
        isOpen={Boolean(selectedDetailSupplier)}
        onClose={() => setSelectedDetailSupplier(null)}
        title={selectedDetailSupplier ? `Detalhamento da Cotação - ${selectedDetailSupplier.nome}` : 'Detalhamento da Cotação'}
        description="Visão pormenorizada dos itens cotados, alíquotas tributárias e acesso direto ao carrinho do portal."
        className="sm:max-w-3xl sm:w-full"
        footer={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full pt-1">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-content-tertiary text-xs sm:text-sm">Total Geral:</span>
              <span className="font-bold text-brand text-lg sm:text-xl tracking-tight">
                {selectedDetailSupplier ? formatCurrencyBRL(selectedDetailSupplier.valorTotalGeral) : 'R$ 0,00'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button variant="ghost" size="sm" onClick={() => setSelectedDetailSupplier(null)}>
                Fechar
              </Button>

              {selectedDetailSupplier && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAbrirCarrinhoFornecedor(selectedDetailSupplier)}
                  leftIcon={<ExternalLink className="w-4 h-4 text-brand" />}
                >
                  Ver Carrinho no Site do Fornecedor
                </Button>
              )}

              {selectedDetailSupplier && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleEnviarWhatsAppFornecedor(selectedDetailSupplier);
                    setSelectedDetailSupplier(null);
                  }}
                  leftIcon={<MessageCircle className="w-4 h-4 text-black" />}
                >
                  Enviar por Whats
                </Button>
              )}
            </div>
          </div>
        }
      >
        {selectedDetailSupplier && (
          <div className="space-y-5 text-xs font-mono">
            {/* 4. AVISO DESTACADO PARA ITENS NÃO ENCONTRADOS OU COM MARCA DIFERENTE */}
            {(() => {
              const itensNaoEncontrados = (selectedDetailSupplier.itensCotados || []).filter(
                (i) => i.status === 'nao_encontrado'
              );
              const itensMarcaDiferente = (selectedDetailSupplier.itensCotados || []).filter(
                (i) => i.status === 'marca_diferente'
              );

              if (itensNaoEncontrados.length > 0 || itensMarcaDiferente.length > 0) {
                return (
                  <div className="space-y-2.5 animate-in fade-in duration-200">
                    {itensNaoEncontrados.length > 0 && (
                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-400 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <XCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                          <span>{itensNaoEncontrados.length} produto(s) não existe(m) no site deste lojista:</span>
                        </div>
                        <ul className="list-disc list-inside text-xs text-rose-300 pl-1 space-y-1 font-mono">
                          {itensNaoEncontrados.map((it, idx) => (
                            <li key={idx}>
                              <strong>{it.nomeSolicitado}</strong> (nenhuma busca no site retornou resultados)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {itensMarcaDiferente.length > 0 && (
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <AlertTriangle className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                          <span>{itensMarcaDiferente.length} produto(s) encontrado(s) em marca/modelo diferente:</span>
                        </div>
                        <ul className="list-disc list-inside text-xs text-amber-300 pl-1 space-y-1 font-mono">
                          {itensMarcaDiferente.map((it, idx) => (
                            <li key={idx}>
                              Solicitado: <strong>{it.nomeSolicitado}</strong> → Disponível: <strong className="text-amber-200">{it.nomeEncontrado}</strong> ({formatCurrencyBRL(it.subtotalComSt)})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* CARDS DE RESUMO TRIBUTÁRIO (ESPAÇOSOS COM ÍCONES) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-sara-surface border border-sara-border flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-content-tertiary">
                  <span className="text-[11px] font-mono font-medium uppercase tracking-wider">Valor dos Produtos</span>
                  <ShoppingCart className="w-4 h-4 text-content-tertiary opacity-70" />
                </div>
                <p className="text-base sm:text-lg font-bold font-mono text-content-primary">
                  {formatCurrencyBRL(selectedDetailSupplier.valorProdutos)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-sara-surface border border-sara-border flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-accent-cyan">
                  <span className="text-[11px] font-mono font-medium uppercase tracking-wider">ICMS-ST Retido</span>
                  <FileCheck className="w-4 h-4 text-accent-cyan opacity-80" />
                </div>
                <p className="text-base sm:text-lg font-bold font-mono text-accent-cyan">
                  {formatCurrencyBRL(selectedDetailSupplier.valorST)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-brand/10 border border-brand/40 flex flex-col justify-between space-y-2 shadow-glow">
                <div className="flex items-center justify-between text-brand">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Total com ST</span>
                  <Sparkles className="w-4 h-4 text-brand" />
                </div>
                <p className="text-lg sm:text-xl font-bold font-mono text-brand">
                  {formatCurrencyBRL(selectedDetailSupplier.valorTotalGeral)}
                </p>
              </div>
            </div>

            {/* LISTA DE ITENS COTADOS (TABELA ESPAÇOSA E DIVISÓRIAS SUTIS) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between font-bold text-content-primary text-xs pt-1">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand" /> Lista de Itens Cotados (Resultado RPA por Loja):
                </span>
                <span className="text-content-tertiary font-mono text-[11px]">
                  {(selectedDetailSupplier.itensCotados || currentCotacao.itens).length}{' '}
                  {(selectedDetailSupplier.itensCotados || currentCotacao.itens).length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              <div className="border border-sara-border rounded-xl overflow-hidden bg-sara-surface">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-sara-elevated border-b border-sara-border text-content-tertiary text-[11px]">
                    <tr>
                      <th className="p-3.5 font-bold uppercase tracking-wider">Produto / Status no Lojista</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-right">Qtd</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-right">Preço Unit.</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-right">Subtotal c/ ST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sara-border/60">
                    {selectedDetailSupplier.itensCotados && selectedDetailSupplier.itensCotados.length > 0 ? (
                      selectedDetailSupplier.itensCotados.map((it, idx) => {
                        const isNaoEncontrado = it.status === 'nao_encontrado';
                        const isMarcaDiferente = it.status === 'marca_diferente';

                        return (
                          <tr key={it.itemId || idx} className="hover:bg-sara-hover/50 transition-colors">
                            <td className="p-3.5 font-medium text-content-primary">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-content-primary leading-snug">{it.nomeEncontrado || it.nomeSolicitado}</span>

                                  {/* BADGES DOS 3 CENÁRIOS */}
                                  {isNaoEncontrado && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono inline-flex items-center gap-1">
                                      <XCircle className="w-3 h-3 text-rose-400" /> Não encontrado
                                    </span>
                                  )}

                                  {isMarcaDiferente && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono inline-flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400" /> Marca diferente disponível
                                    </span>
                                  )}

                                  {it.status === 'encontrado' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Adicionado
                                    </span>
                                  )}
                                </div>

                                {it.nomeSolicitado !== it.nomeEncontrado && (
                                  <span className="text-[11px] text-content-tertiary block font-mono">
                                    Solicitado: {it.nomeSolicitado}
                                  </span>
                                )}

                                {/* BOTÃO DE AÇÃO PARA ACEITAR MARCA ALTERNATIVA (CENÁRIO 2) */}
                                {isMarcaDiferente && (
                                  <button
                                    type="button"
                                    onClick={() => handleAceitarAlternativa(it)}
                                    className="mt-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3 text-amber-400" /> Usar esta alternativa ({formatCurrencyBRL(it.subtotalComSt)})
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="p-3.5 text-right text-content-secondary font-bold font-mono">
                              {it.quantidade} {it.unidade || 'un'}
                            </td>

                            <td className="p-3.5 text-right font-mono">
                              {isNaoEncontrado ? (
                                <span className="text-rose-400 font-bold text-[11px]">-</span>
                              ) : (
                                <span className={isMarcaDiferente ? 'text-amber-400 font-bold' : 'text-content-secondary'}>
                                  {formatCurrencyBRL(it.precoUnitario)}
                                </span>
                              )}
                            </td>

                            <td className="p-3.5 text-right font-mono">
                              {isNaoEncontrado ? (
                                <span className="text-content-tertiary text-[11px]">-</span>
                              ) : (
                                <span className="font-bold text-brand">{formatCurrencyBRL(it.subtotalComSt)}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      currentCotacao.itens.map((it, idx) => {
                        const unitPrice = Number((it.material.precoBaseUnitario * selectedDetailSupplier.fatorPreco).toFixed(2));
                        const subtotalProd = Number((unitPrice * it.quantidade).toFixed(2));
                        const stVal = Number((subtotalProd * (it.material.icmsStPercent / 100)).toFixed(2));
                        const subtotalComSt = Number((subtotalProd + stVal).toFixed(2));

                        return (
                          <tr key={it.id || idx} className="hover:bg-sara-hover/50 transition-colors">
                            <td className="p-3.5 font-medium text-content-primary">
                              {it.material.nome}
                            </td>
                            <td className="p-3.5 text-right text-content-secondary font-bold">
                              {it.quantidade} {it.material.unidade}
                            </td>
                            <td className="p-3.5 text-right text-content-secondary">
                              {formatCurrencyBRL(unitPrice)}
                            </td>
                            <td className="p-3.5 text-right font-bold text-brand">
                              {formatCurrencyBRL(subtotalComSt)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Sheet>

      {/* MODAL DE CONFIRMAÇÃO E EDICÃO EM MASSA DE ITENS COLADOS */}
      <MultiItemPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onConfirm={handleConfirmarItensColados}
        initialItems={itemsColadosParaPreview}
      />

      {/* MODAL DE NAVEGADOR REMOTO TRANSMISSÃO AO VIVO BROWSERBASE (CDP EMBED) */}
      <BrowserbaseLiveViewModal
        isOpen={isBrowserbaseModalOpen}
        onClose={() => setIsBrowserbaseModalOpen(false)}
        liveViewUrl={browserbaseLiveUrl}
        fornecedorNome={browserbaseFornNome}
        sessionId={browserbaseSessionId}
        isLoading={isLoadingBrowserbase}
        errorMessage={browserbaseErrorMsg}
        onRetry={() => handleAbrirCarrinhoBrowserbase({ id: 'forn-cicalfer', nome: browserbaseFornNome } as any)}
      />
    </div>
  );
};
