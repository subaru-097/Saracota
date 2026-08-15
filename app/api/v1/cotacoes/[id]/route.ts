import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

/**
 * GET /api/v1/cotacoes/[id]
 * Detalhes de uma cotação por ID ou Código (#8492)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cotacao = await db.cotacoes.getById(params.id);

    if (!cotacao) {
      return NextResponse.json(
        {
          error: true,
          message: `Cotação ${params.id} não encontrada.`,
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: cotacao,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao buscar cotação',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/cotacoes/[id]
 * Atualizar status da cotação (aprovar / recusar) no banco real
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status } = body;

    if (!status || !['aprovada', 'recusada', 'pendente'].includes(status)) {
      return NextResponse.json(
        {
          error: true,
          message: "O campo status é obrigatório e deve ser 'aprovada', 'recusada' ou 'pendente'.",
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    const ok = await db.cotacoes.updateStatus(params.id, status);

    if (!ok) {
      return NextResponse.json(
        {
          error: true,
          message: `Falha ao atualizar o status da cotação ${params.id}.`,
          code: 'DATABASE_ERROR',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: { id: params.id, status },
      meta: {
        message: `Status da cotação ${params.id} atualizado para ${status}.`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao atualizar status da cotação',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
