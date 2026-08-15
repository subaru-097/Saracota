import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

/**
 * GET /api/v1/fornecedores
 * Listar rede de lojistas credenciados com busca por query
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const fornecedores = await db.fornecedores.list(query);

    return NextResponse.json({
      data: fornecedores,
      meta: {
        total: fornecedores.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao listar fornecedores',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/fornecedores
 * Cadastrar novo lojista no banco real
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nome) {
      return NextResponse.json(
        {
          error: true,
          message: 'O campo nome é obrigatório.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    const novoFornecedor = await db.fornecedores.create(body);

    return NextResponse.json(
      {
        data: novoFornecedor,
        meta: {
          message: 'Fornecedor cadastrado com sucesso',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao cadastrar fornecedor',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
