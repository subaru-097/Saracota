import { NextRequest, NextResponse } from 'next/server';
import { consolidarComparativoCotacao } from '@/lib/services/cotacaoConsolidationService';
import { UF } from '@/types';

/**
 * GET /api/v1/cotacoes/[id]/comparativo
 * Retorna a matriz comparativa de cotação normalizada dos 3 fornecedores (Cicalfer, Construjá, Cofema)
 * com marcas substitutas sinalizadas, detalhamento tributário de ICMS-ST e cálculo da Cesta Otimizada.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cotacaoId = params.id;
    const searchParams = req.nextUrl.searchParams;
    const ufDestino = (searchParams.get('uf') || 'SP').toUpperCase() as UF;

    if (!cotacaoId) {
      return NextResponse.json(
        {
          error: true,
          message: 'O ID da cotação é obrigatório na URL.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    const consolidado = await consolidarComparativoCotacao(cotacaoId, ufDestino);

    return NextResponse.json({
      data: consolidado,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error(`[API ERROR] Erro na rota GET /api/v1/cotacoes/${params.id}/comparativo:`, error.stack || error);
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao consolidar comparativo de cotação.',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
