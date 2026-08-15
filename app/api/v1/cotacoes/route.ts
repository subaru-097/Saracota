import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

/**
 * GET /api/v1/cotacoes
 * Listar todas as cotações ativas
 */
export async function GET() {
  try {
    const cotacoes = await db.cotacoes.list();
    return NextResponse.json({
      data: cotacoes,
      meta: {
        total: cotacoes.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro interno ao listar cotações',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/cotacoes
 * Criar nova cotação
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.projeto && !body.origemTextoOriginal) {
      return NextResponse.json(
        {
          error: true,
          message: 'Parâmetros inválidos. Informe o projeto ou lista de produtos.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    const novaCotacao = await db.cotacoes.create(body);

    return NextResponse.json(
      {
        data: novaCotacao,
        meta: {
          message: 'Cotação criada com sucesso',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao processar criação de cotação',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
