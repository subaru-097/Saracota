import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, sessionId, cotacaoId, fornecedorId } = body;

    const { Browserbase } = require('@browserbasehq/sdk');
    const apiKey = process.env.BROWSERBASE_API_KEY || 'demo-browserbase-api-key';

    // RENOVAÇÃO DO TOKEN JWT DA LIVE VIEW URL (RE-SIGNING SILENCIOSO)
    if (action === 'refresh' && sessionId) {
      console.log(`🔄 [API REFRESH] Renovando token JWT assinado para sessão ${sessionId}...`);
      if (apiKey !== 'demo-browserbase-api-key') {
        const bb = new Browserbase({ apiKey });
        const debugLinks = await bb.sessions.debug(sessionId);
        const liveViewUrl = (debugLinks as any).debuggerFullscreenUrl || (debugLinks as any).debuggerUrl;
        if (!liveViewUrl) {
          throw new Error(`Live View não disponível para sessão ${sessionId}`);
        }
        return NextResponse.json({
          sucesso: true,
          sessionId,
          liveViewUrl,
          iframeUrl: liveViewUrl,
          mensagem: 'Token assinado renovado com sucesso.',
        });
      }
    }

    // ENCERRAMENTO EXPLÍCITO DA SESSÃO AO FECHAR O MODAL
    if (action === 'close' && sessionId) {
      console.log(`⏹️ [API CLOSE] Solicitando encerramento da sessão ${sessionId} no Browserbase...`);
      if (apiKey !== 'demo-browserbase-api-key') {
        const bb = new Browserbase({ apiKey });
        const projectId = process.env.BROWSERBASE_PROJECT_ID;
        await bb.sessions.update(sessionId, { projectId, status: 'REQUEST_RELEASE' } as any).catch(() => {});
        return NextResponse.json({
          sucesso: true,
          sessionId,
          mensagem: 'Sessão liberada com sucesso (REQUEST_RELEASE).',
        });
      }
    }

    // REGRA 4: BUSCAR SESSÃO JÁ CRIADA DA COTAÇÃO (NUNCA CHAMAR bb.sessions.create() AQUI)
    let targetSessionId = sessionId;

    if (!targetSessionId && cotacaoId) {
      targetSessionId = await db.cotacoes.obterBrowserbaseSessionId(cotacaoId, fornecedorId);
    }

    // Se ainda não houver sessionId cadastrado, verificar no cache de sessões ativas
    if (!targetSessionId && apiKey !== 'demo-browserbase-api-key') {
      const bb = new Browserbase({ apiKey });
      try {
        const activeList = await bb.sessions.list({ status: 'RUNNING' } as any);
        const runningList = (activeList as any[]).filter((s) => s.status === 'RUNNING');
        if (runningList.length > 0) {
          targetSessionId = runningList[0].id;
        }
      } catch (e: any) {
        console.warn('⚠️ [API SESSION WARN] Erro ao buscar sessões ativas:', e.message);
      }
    }

    if (!targetSessionId) {
      return NextResponse.json(
        {
          sucesso: false,
          error: `Cotação ${cotacaoId || ''} ainda não possui sessão Browserbase ativa.`,
        },
        { status: 404 }
      );
    }

    if (apiKey === 'demo-browserbase-api-key') {
      const mockUrl = `https://www.browserbase.com/v1/sessions/${targetSessionId}/debug`;
      return NextResponse.json({
        sucesso: true,
        sessionId: targetSessionId,
        liveViewUrl: mockUrl,
        iframeUrl: mockUrl,
      });
    }

    const bb = new Browserbase({ apiKey });
    console.log('[LIVE-VIEW] sessão usada:', targetSessionId);

    const debugLinks = await bb.sessions.debug(targetSessionId);
    const liveViewUrl = (debugLinks as any).debuggerFullscreenUrl || (debugLinks as any).debuggerUrl;

    if (!liveViewUrl) {
      throw new Error(`Live View não gerada para a sessão ${targetSessionId}`);
    }

    console.log('[LIVE-VIEW] url gerada:', liveViewUrl);

    return NextResponse.json({
      sucesso: true,
      sessionId: targetSessionId,
      liveViewUrl,
      iframeUrl: liveViewUrl,
    });
  } catch (error: any) {
    console.error('❌ Erro no endpoint /api/browserbase/session:', error);

    const msg = (error.message || '').toLowerCase();
    let httpStatus = 500;
    if (msg.includes('429') || msg.includes('simult') || msg.includes('concorr')) {
      httpStatus = 429;
    } else if (msg.includes('402') || msg.includes('minut') || msg.includes('plan')) {
      httpStatus = 402;
    } else if (msg.includes('ainda não possui') || msg.includes('404')) {
      httpStatus = 404;
    }

    return NextResponse.json(
      {
        sucesso: false,
        error: error.message || 'Erro ao obter Live View da sessão Browserbase',
      },
      { status: httpStatus }
    );
  }
}
