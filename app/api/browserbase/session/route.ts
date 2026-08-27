import { NextRequest, NextResponse } from 'next/server';
import { BrowserbaseService } from '@/lib/services/automacao/browserbaseService';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, sessionId, fornecedorId = 'forn-cicalfer', fornecedorNome = 'Cicalfer', fornecedorUrl = '', itens = [] } = body;

    // RENOVAÇÃO DO TOKEN JWT DA LIVE VIEW URL (RE-SIGNING SILENCIOSO)
    if (action === 'refresh' && sessionId) {
      console.log(`🔄 [API REFRESH] Renovando token JWT assinado para sessão ${sessionId}...`);
      const { Browserbase } = require('@browserbasehq/sdk');
      const apiKey = process.env.BROWSERBASE_API_KEY || 'demo-browserbase-api-key';

      if (apiKey !== 'demo-browserbase-api-key') {
        const bb = new Browserbase({ apiKey });
        const debugLinks = await bb.sessions.debug(sessionId);
        const liveViewUrl = (debugLinks as any).debuggerFullscreenUrl || (debugLinks as any).debuggerUrl || '';
        return NextResponse.json({
          sucesso: true,
          success: true,
          sessionId,
          liveViewUrl,
          iframeUrl: liveViewUrl,
          mensagem: 'Token assinado renovado com sucesso.',
        });
      }
    }

    // ENCERRAMENTO EXPLÍCITO DA SESSÃO AO FECHAR O MODAL (ECONOMIA RIGOROSA DE MINUTOS)
    if (action === 'close' && sessionId) {
      console.log(`⏹️ [API CLOSE] Solicitando encerramento explícito da sessão ${sessionId} no Browserbase...`);
      const { Browserbase } = require('@browserbasehq/sdk');
      const apiKey = process.env.BROWSERBASE_API_KEY || 'demo-browserbase-api-key';

      if (apiKey !== 'demo-browserbase-api-key') {
        const bb = new Browserbase({ apiKey });
        await bb.sessions.update(sessionId, { status: 'REQUESTED' } as any).catch(() => {});
        return NextResponse.json({
          sucesso: true,
          success: true,
          sessionId,
          mensagem: 'Sessão encerrada com sucesso no servidor.',
        });
      }
    }

    console.log('📡 [API /api/browserbase/session] Criando e navegando sessão remota sequencialmente...', {
      fornecedorId,
      fornecedorNome,
      fornecedorUrl,
      itensCount: itens.length,
    });

    // EXECUÇÃO SEQUENCIAL RIGOROSA:
    // 1º Criar a sessão no Browserbase
    // 2º Conectar Playwright via CDP e navegar para a URL do fornecedor (page.goto)
    // 3º Adicionar os itens solicitados ao carrinho
    // 4º SOMENTE DEPOIS disso, obter a debuggerFullscreenUrl e responder o JSON
    const sessaoInfo = await BrowserbaseService.criarEMontarSessaoRemota({
      fornecedorId,
      fornecedorUrl,
      itens,
    });

    // Retorno para o frontend exibir o Iframe com a página do fornecedor já carregada
    return NextResponse.json({
      sucesso: true,
      success: true,
      status: 'SESSAO_REMOTA_CRIADA_E_NAVEGADA',
      sessionId: sessaoInfo.sessionId,
      connectUrl: sessaoInfo.connectUrl,
      liveViewUrl: sessaoInfo.liveViewUrl,
      iframeUrl: sessaoInfo.liveViewUrl,
      mensagem: `Sessão remota iniciada. Navegação para o site do fornecedor concluída.`,
      fornecedorNome,
    });
  } catch (error: any) {
    console.error('❌ Erro no endpoint /api/browserbase/session:', error);
    return NextResponse.json(
      {
        sucesso: false,
        error: error.message || 'Erro interno ao criar sessão no Browserbase',
      },
      { status: 500 }
    );
  }
}
