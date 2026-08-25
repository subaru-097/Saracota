import { NextRequest, NextResponse } from 'next/server';
import { loginFornecedor } from '@/lib/services/automacao/loginFornecedor';

/**
 * POST /api/automacao/testar-login/:fornecedorId
 * Endpoint exclusivo para testar a automação de login via Playwright por ID de Fornecedor
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { fornecedorId: string } }
) {
  try {
    const fornecedorId = params.fornecedorId;
    if (!fornecedorId) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'FORNECEDOR_NAO_ENCONTRADO',
          mensagem: 'Informe o ID do fornecedor na URL.',
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
        mensagem: error.message || 'Erro ao processar teste de login automatizado.',
      },
      { status: 500 }
    );
  }
}
