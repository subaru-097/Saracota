'use client';

import React, { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, ShieldCheck, Sparkles, MonitorPlay } from 'lucide-react';

export interface BrowserbaseLiveViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveViewUrl: string;
  fornecedorNome: string;
  sessionId?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onUpdateLiveUrl?: (newUrl: string) => void;
}

export const BrowserbaseLiveViewModal: React.FC<BrowserbaseLiveViewModalProps> = ({
  isOpen,
  onClose,
  liveViewUrl,
  fornecedorNome,
  sessionId,
  isLoading = false,
  errorMessage,
  onRetry,
  onUpdateLiveUrl,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // RENOVAÇÃO SILENCIOSA DO TOKEN JWT DA LIVE VIEW URL A CADA 4 MINUTOS
  React.useEffect(() => {
    if (!isOpen || !sessionId) return;
    const intervalId = setInterval(async () => {
      try {
        console.log(`🔄 [BROWSERBASE TOKEN REFRESH] Renovando token assinado para sessão ${sessionId}...`);
        const res = await fetch('/api/browserbase/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'refresh', sessionId }),
        });
        const data = await res.json();
        if (data.sucesso && data.liveViewUrl && onUpdateLiveUrl) {
          onUpdateLiveUrl(data.liveViewUrl);
        }
      } catch (err: any) {
        console.warn('⚠️ [BROWSERBASE REFRESH WARN] Falha ao renovar token da live view:', err.message);
      }
    }, 4 * 60 * 1000); // 4 minutos

    return () => clearInterval(intervalId);
  }, [isOpen, sessionId, onUpdateLiveUrl]);

  const handleRefreshIframe = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Navegador Remoto — ${fornecedorNome}`}
      description="Sessão de automação remota conectada via Browserbase (CDP). Conclua seu pedido diretamente no modal abaixo."
      className={isFullscreen ? 'sm:max-w-[95vw] sm:w-[95vw] h-[95vh]' : 'sm:max-w-4xl sm:w-full'}
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full font-mono text-xs">
          <div className="flex items-center gap-2 text-content-secondary">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Sessão segura e autenticada no servidor remoto.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fechar Janela
            </Button>

            {liveViewUrl && !errorMessage && (
              <a href={liveViewUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  Abrir em Nova Aba
                </Button>
              </a>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3.5 font-mono">
        {/* Banner de Status da Sessão Remota */}
        <div className="p-3.5 rounded-xl bg-sara-surface border border-sara-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center shrink-0">
              <MonitorPlay className="w-5 h-5 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-content-primary">
                  Sessão Browserbase {sessionId ? `(#${sessionId.slice(-6)})` : ''}
                </span>
                <Badge variant={errorMessage ? 'rose' : 'emerald'} size="sm" className="gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${errorMessage ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`} />
                  {errorMessage ? 'Falha de Conexão' : 'Sessão Remota Ativa'}
                </Badge>
              </div>
              <p className="text-[11px] text-content-tertiary mt-0.5">
                {errorMessage ? 'Ocorreu um problema ao estabelecer a sessão remota.' : 'Os itens cotados foram montados no carrinho do fornecedor. Você pode clicar e finalizar a compra na tela abaixo.'}
              </p>
            </div>
          </div>

          {/* Botões de Ação do Player */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleRefreshIframe}
              className="p-2 rounded-lg bg-sara-elevated border border-sara-border text-content-secondary hover:text-brand hover:border-brand/40 transition-colors"
              title="Recarregar tela remota"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-2 rounded-lg bg-sara-elevated border border-sara-border text-content-secondary hover:text-brand hover:border-brand/40 transition-colors"
              title={isFullscreen ? 'Reduzir tamanho' : 'Expandir tela'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Container do Iframe / Live View / State de Erro */}
        <div className="relative rounded-xl border border-sara-border bg-black/90 overflow-hidden shadow-2xl min-h-[500px]">
          {isLoading && !errorMessage ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-sara-surface/95 z-20 font-mono">
              <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-content-primary">Iniciando Navegador Remoto Browserbase...</p>
                <p className="text-xs text-content-tertiary">Conectando Playwright via CDP e montando o carrinho na Cicalfer.</p>
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="flex flex-col items-center justify-center h-[520px] p-6 text-center space-y-4 bg-sara-surface/95 font-mono">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md">
                <p className="text-sm font-bold text-rose-400">Falha ao Conectar Sessão Remota</p>
                <p className="text-xs text-content-secondary">{errorMessage}</p>
              </div>
              {onRetry && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onRetry}
                  leftIcon={<RefreshCw className="w-4 h-4 text-black" />}
                >
                  Tentar Novamente
                </Button>
              )}
            </div>
          ) : liveViewUrl ? (
            <iframe
              key={iframeKey}
              src={liveViewUrl}
              title={`Live View - ${fornecedorNome}`}
              className={`w-full ${isFullscreen ? 'h-[75vh]' : 'h-[520px]'} border-0`}
              allow="fullscreen; clipboard-read; clipboard-write"
            />
          ) : !isLoading ? (
            <div className="flex flex-col items-center justify-center h-[520px] p-6 text-center space-y-3 bg-sara-surface/95 font-mono">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <RefreshCw className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-rose-400">Sessão remota indisponível</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[520px] text-content-tertiary space-y-2 font-mono">
              <Sparkles className="w-8 h-8 text-brand animate-bounce" />
              <p className="text-xs">Aguardando inicialização da URL da transmissão ao vivo...</p>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
};
