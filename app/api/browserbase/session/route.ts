import { NextRequest, NextResponse } from 'next/server';
import { BrowserbaseService } from '@/lib/services/automacao/browserbaseService';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { fornecedorId = 'forn-cicalfer', fornecedorNome = 'Cicalfer', fornecedorUrl = '', itens = [] } = body;

    console.log('📡 [API /api/browserbase/session] Criando sessão remota instantânea (Fase 1)...', {
      fornecedorId,
      fornecedorNome,
      fornecedorUrl,
      itensCount: itens.length,
    });

    // FASE 1: Criar sessão remota e obter Live View URL em < 1.5s
    const sessaoInfo = await BrowserbaseService.criarSessaoRemota();

    // FASE 2: Iniciar automação do Playwright via CDP em background (sem bloquear a resposta HTTP)
    BrowserbaseService.executarMontagemCarrinhoBackground({
      connectUrl: sessaoInfo.connectUrl,
      fornecedorId,
      fornecedorUrl,
      itens,
    }).catch((bgErr) => {
      console.warn('⚠️ [BROWSERBASE WORKER BACKGROUND] Aviso ao processar automação:', bgErr.message);
    });

    // Retorno instantâneo para o frontend exibir o Iframe imediatamente
    return NextResponse.json({
      sucesso: true,
      status: 'SESSAO_REMOTA_CRIADA_INSTANTANEA',
      sessionId: sessaoInfo.sessionId,
      connectUrl: sessaoInfo.connectUrl,
      liveViewUrl: sessaoInfo.liveViewUrl,
      mensagem: `Sessão remota iniciada. Exibindo transmissão ao vivo...`,
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
