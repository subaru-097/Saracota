import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

/**
 * GET /api/v1/fornecedores
 * Listar rede de lojistas credenciados com busca por query (com senhas mascaradas)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const fornecedores = await db.fornecedores.list(query);

    // Mascarar senhas por segurança
    const sanitizedList = fornecedores.map((f) => ({
      ...f,
      senhaCriptografada: f.senhaCriptografada ? '••••••••' : undefined,
    }));

    return NextResponse.json({
      data: sanitizedList,
      meta: {
        total: sanitizedList.length,
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
 * Cadastrar novo lojista no banco real (com criptografia de senha)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nome || !body.nome.trim()) {
      return NextResponse.json(
        {
          error: true,
          message: 'O campo nome é obrigatório.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    const novoFornecedor = await db.fornecedores.create({
      nome: body.nome,
      categoria: body.categoria || 'Elétrica',
      whatsapp: body.whatsapp,
      urlPortalB2B: body.urlPortalB2B,
      login: body.login,
      senha: body.senha,
      observacoes: body.observacoes,
    });

    const sanitized = {
      ...novoFornecedor,
      senhaCriptografada: novoFornecedor.senhaCriptografada ? '••••••••' : undefined,
    };

    return NextResponse.json(
      {
        data: sanitized,
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

/**
 * PUT /api/v1/fornecedores
 * Editar lojista existente no banco real
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json(
        {
          error: true,
          message: 'O ID do fornecedor é obrigatório para atualização.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    await db.fornecedores.update(body.id, {
      nome: body.nome,
      categoria: body.categoria,
      whatsapp: body.whatsapp,
      urlPortalB2B: body.urlPortalB2B,
      login: body.login,
      senha: body.senha,
      observacoes: body.observacoes,
    });

    return NextResponse.json({
      data: { id: body.id, success: true },
      meta: {
        message: 'Fornecedor atualizado com sucesso',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao atualizar fornecedor',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/fornecedores?id=forn-123
 * Excluir lojista do banco real
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          error: true,
          message: 'Informe o ID do fornecedor a ser removido.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    const result = await db.fornecedores.delete(id);
    if (!result.success) {
      return NextResponse.json(
        {
          error: true,
          message: result.errorMsg || 'Erro ao excluir fornecedor.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: { id, success: true },
      meta: {
        message: 'Fornecedor excluído com sucesso',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao excluir fornecedor',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
