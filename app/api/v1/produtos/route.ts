import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

/**
 * GET /api/v1/produtos
 * Listar catálogo de produtos com suporte a busca por query
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const categoria = searchParams.get('categoria') || 'todos';

    let produtos = await db.produtos.list();

    if (categoria !== 'todos') {
      produtos = produtos.filter((p) => p.categoria === categoria);
    }

    if (query.trim()) {
      const qUpper = query.toUpperCase();
      produtos = produtos.filter(
        (p) =>
          p.nome.toUpperCase().includes(qUpper) ||
          p.ncm.includes(query) ||
          p.sku.toUpperCase().includes(qUpper)
      );
    }

    return NextResponse.json({
      data: produtos,
      meta: {
        total: produtos.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao consultar catálogo de produtos',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/produtos
 * Cadastrar novo produto no catálogo
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nome || !body.ncm || !body.sku) {
      return NextResponse.json(
        {
          error: true,
          message: 'Informe nome, ncm e sku obrigatórios.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    const novoProduto = await db.produtos.create(body);

    return NextResponse.json(
      {
        data: novoProduto,
        meta: {
          message: 'Produto cadastrado com sucesso',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao cadastrar produto',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
