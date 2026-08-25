import { NextRequest, NextResponse } from 'next/server';
import { obterStatusCotacao } from '@/lib/services/automacao/matchingEngine';

/**
 * GET /api/cotacoes/:cotacaoId/status
 * Endpoint de Polling Opcional: Permite consultar o progresso em tempo real de uma cotação no servidor
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { cotacaoId: string } }
) {
  try {
    const cotacaoId = params.cotacaoId;

    if (!cotacaoId) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: 'ID da cotação é obrigatório na URL.',
        },
        { status: 400 }
      );
    }

    const statusData = await obterStatusCotacao(cotacaoId);

    return NextResponse.json(
      {
        sucesso: true,
        ...statusData,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        sucesso: false,
        status: 'erro',
        mensagem: error.message || 'Erro ao consultar status da cotação.',
      },
      { status: 500 }
    );
  }
}
