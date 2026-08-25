import { NextRequest, NextResponse } from 'next/server';
import { processarCotacaoTodosFornecedores } from '@/lib/services/automacao/matchingEngine';

/**
 * POST /api/cotacoes/processar
 * Body: { cotacaoId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const cotacaoId = body.cotacaoId || body.id;

    if (!cotacaoId) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'ERRO',
          mensagem: 'Informe o ID da cotação no corpo da requisição { cotacaoId: "..." } ou na URL /api/cotacoes/:cotacaoId/processar.',
        },
        { status: 400 }
      );
    }

    // Disparar o processamento assíncrono em background sem travar a requisição HTTP
    processarCotacaoTodosFornecedores(cotacaoId).catch((err) => {
      console.error(`[API Background Error] Erro ao processar cotação ${cotacaoId}:`, err);
    });

    return NextResponse.json({
      sucesso: true,
      status: 'processamento iniciado',
      mensagem: `Processamento de cotação com robôs RPA iniciado em segundo plano para a cotação ${cotacaoId}.`,
      cotacaoId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        sucesso: false,
        status: 'ERRO',
        mensagem: error.message || 'Erro ao iniciar o processamento da cotação.',
      },
      { status: 500 }
    );
  }
}
