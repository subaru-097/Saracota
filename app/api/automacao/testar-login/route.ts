import { NextRequest, NextResponse } from 'next/server';
import { loginFornecedor } from '@/lib/services/automacao/loginFornecedor';

/**
 * POST /api/automacao/testar-login
 * Body: { fornecedorId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fornecedorId = body.fornecedorId || body.id;

    if (!fornecedorId) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'FORNECEDOR_NAO_ENCONTRADO',
          mensagem: 'Informe o ID do fornecedor no corpo da requisição { fornecedorId: "..." } ou na URL /api/automacao/testar-login/:fornecedorId.',
        },
        { status: 400 }
      );
    }

    const resultado = await loginFornecedor(fornecedorId);

    return NextResponse.json(resultado, {
      status: resultado.sucesso ? 200 : 400,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        sucesso: false,
        status: 'TIMEOUT',
        mensagem: error.message || 'Erro interno ao processar teste de login.',
      },
      { status: 500 }
    );
  }
}
