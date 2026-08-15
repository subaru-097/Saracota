import { NextRequest, NextResponse } from 'next/server';
import { processarMensagemWhatsApp, WhatsAppIncomingPayload } from '@/lib/services/whatsapp';

/**
 * POST /api/v1/webhooks/whatsapp
 * Recebe mensagens de texto/áudio do WhatsApp Business API, faz transcrição,
 * extração de itens e cria rascunho de cotação.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extrair parâmetros do webhook
    const payload: WhatsAppIncomingPayload = {
      messageId: body.messageId || `msg-${Date.now()}`,
      fromPhoneNumber: body.fromPhoneNumber || body.from || '+5511987654321',
      nomeContato: body.nomeContato || body.pushName || 'Encarregado Marcos',
      type: body.type || (body.mediaUrl ? 'audio' : 'text'),
      mediaUrl: body.mediaUrl,
      textBody: body.textBody || body.text || body.caption,
      projetoId: body.projetoId,
    };

    // Processar transcrição, extração e rascunho
    const resultado = await processarMensagemWhatsApp(payload);

    return NextResponse.json(
      {
        data: {
          cotacaoId: resultado.cotacaoCriada.id,
          codigoCotacao: resultado.cotacaoCriada.codigoCotacao,
          transcricaoTexto: resultado.transcricaoTexto,
          itensExtraidosCount: resultado.itensExtraidosCount,
          valorTotalGeral: resultado.cotacaoCriada.valorTotalGeral,
          whatsappMensagemResposta: resultado.whatsappMensagemResposta,
          linkPainelWeb: resultado.linkPainelWeb,
        },
        meta: {
          message: 'Webhook WhatsApp processado com sucesso. Rascunho criado.',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao processar webhook do WhatsApp',
        code: 'WHATSAPP_WEBHOOK_ERROR',
      },
      { status: 500 }
    );
  }
}
