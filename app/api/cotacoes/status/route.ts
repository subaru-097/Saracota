import { NextRequest, NextResponse } from 'next/server';
import { obterStatusCotacao } from '@/lib/services/automacao/matchingEngine';

/**
 * GET /api/cotacoes/status
 * Query Params: ?id=... ou ?cotacaoId=...
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cotacaoId = searchParams.get('id') || searchParams.get('cotacaoId');

    if (!cotacaoId) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: 'Informe o ID da cotação nos parâmetros de busca: ?cotacaoId=...',
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
